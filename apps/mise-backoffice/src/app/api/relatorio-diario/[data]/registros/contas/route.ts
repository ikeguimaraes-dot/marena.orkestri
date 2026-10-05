import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canAccessUnit } from '@/app/api/relatorio-diario/_auth'
import { CONTA_ASSINADA_CATEGORIAS } from '@/app/api/relatorio-diario/_schema'

async function getRelatorio(supabase: ReturnType<typeof createServiceClient>, unitId: string, dataParam: string) {
  const { data } = await supabase
    .from('op_relatorio_diario').select('id, status').eq('unit_id', unitId).eq('data', dataParam).single()
  return data
}

export async function POST(request: Request, { params }: { params: Promise<{ data: string }> }) {
  const { data: dataParam } = await params
  const body = await request.json()
  // introspect: tabela real = op_assinada; colunas: nome, categoria, valor, observacao, periodo, numero_mesa, num_pessoas
  const { unit_id, nome, categoria, valor, observacao, periodo, numero_mesa, num_pessoas } = body

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })
  if (!nome?.trim()) return NextResponse.json({ error: 'nome obrigatório.' }, { status: 400 })
  if (!categoria || !CONTA_ASSINADA_CATEGORIAS.includes(categoria)) {
    return NextResponse.json({ error: 'categoria inválida.' }, { status: 400 })
  }

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()
  const relatorio = await getRelatorio(supabase, unit_id, dataParam)
  if (!relatorio) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  if (relatorio.status === 'enviado') return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })

  const { data, error } = await supabase
    .from('op_assinada')
    .insert({
      relatorio_id: relatorio.id,
      nome: nome.trim(),
      categoria,
      valor: valor !== undefined && valor !== '' ? parseFloat(valor) : null,
      observacao: observacao?.trim() ?? null,
      periodo: periodo ?? null,
      numero_mesa: numero_mesa ? parseInt(numero_mesa) : null,
      num_pessoas: num_pessoas ? parseInt(num_pessoas) : null,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ data: string }> }) {
  const { data: dataParam } = await params
  const { searchParams } = new URL(request.url)
  const unit_id = searchParams.get('unit_id')
  const id = searchParams.get('id')
  if (!unit_id || !id) return NextResponse.json({ error: 'unit_id e id obrigatórios.' }, { status: 400 })

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()
  const relatorio = await getRelatorio(supabase, unit_id, dataParam)
  if (!relatorio) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  if (relatorio.status === 'enviado') return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })

  const { error } = await supabase.from('op_assinada').delete().eq('id', id).eq('relatorio_id', relatorio.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
