import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canAccessUnit } from '@/app/api/relatorio-diario/_auth'
import { OP_86_MOTIVOS } from '@/app/api/relatorio-diario/_schema'

async function getRelatorioId(supabase: ReturnType<typeof createServiceClient>, unitId: string, dataParam: string) {
  const { data } = await supabase
    .from('op_relatorio_diario')
    .select('id, status')
    .eq('unit_id', unitId)
    .eq('data', dataParam)
    .single()
  return data
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ data: string }> }
) {
  const { data: dataParam } = await params
  const body = await request.json()
  // introspect confirmou: periodo é text enum (almoco/jantar/manha), não FK periodo_id
  const { unit_id, produto_nome, motivo, periodo, setor, observacao } = body

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })
  if (!produto_nome?.trim()) return NextResponse.json({ error: 'produto_nome obrigatório.' }, { status: 400 })
  if (!OP_86_MOTIVOS.includes(motivo)) {
    return NextResponse.json({ error: `Motivo inválido. Valores aceitos: ${OP_86_MOTIVOS.join(', ')}.` }, { status: 400 })
  }

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()
  const relatorio = await getRelatorioId(supabase, unit_id, dataParam)
  if (!relatorio) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  if (relatorio.status === 'enviado') return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })

  const { data, error } = await supabase
    .from('op_86')
    .insert({
      relatorio_id: relatorio.id,
      produto_nome: produto_nome.trim(),
      motivo,
      periodo: periodo ?? null,
      setor: setor ?? null,
      observacao: observacao?.trim() ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ data: string }> }
) {
  const { data: dataParam } = await params
  const { searchParams } = new URL(request.url)
  const unit_id = searchParams.get('unit_id')
  const id = searchParams.get('id')

  if (!unit_id || !id) return NextResponse.json({ error: 'unit_id e id obrigatórios.' }, { status: 400 })

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()
  const relatorio = await getRelatorioId(supabase, unit_id, dataParam)
  if (!relatorio) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  if (relatorio.status === 'enviado') return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })

  const { error } = await supabase
    .from('op_86')
    .delete()
    .eq('id', id)
    .eq('relatorio_id', relatorio.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
