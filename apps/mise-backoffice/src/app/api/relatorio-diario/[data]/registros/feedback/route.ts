import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canAccessUnit } from '@/app/api/relatorio-diario/_auth'
import { FEEDBACK_CATEGORIAS } from '@/app/api/relatorio-diario/_schema'

async function getRelatorio(supabase: ReturnType<typeof createServiceClient>, unitId: string, dataParam: string) {
  const { data } = await supabase
    .from('op_relatorio_diario').select('id, status').eq('unit_id', unitId).eq('data', dataParam).single()
  return data
}

export async function POST(request: Request, { params }: { params: Promise<{ data: string }> }) {
  const { data: dataParam } = await params
  const body = await request.json()
  const { unit_id, tipo, produto, categoria, descricao, periodo } = body

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })
  if (!['elogio', 'reclamacao'].includes(tipo)) return NextResponse.json({ error: 'tipo inválido.' }, { status: 400 })
  if (categoria && !FEEDBACK_CATEGORIAS.includes(categoria)) {
    return NextResponse.json(
      { error: `categoria inválida. Valores aceitos: ${FEEDBACK_CATEGORIAS.join(', ')}.` },
      { status: 400 }
    )
  }

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()
  const relatorio = await getRelatorio(supabase, unit_id, dataParam)
  if (!relatorio) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  if (relatorio.status === 'enviado') return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })

  // introspect confirmou: texto (não descricao), periodo como text, produto (não produto_nome)
  const { data, error } = await supabase
    .from('op_feedback_cliente')
    .insert({
      relatorio_id: relatorio.id,
      tipo,
      produto: produto?.trim() ?? null,
      categoria: categoria ?? null,
      texto: descricao?.trim() ?? null,
      periodo: periodo ?? null,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ data: string }> }) {
  const { data: dataParam } = await params
  const body = await request.json()
  const { unit_id, id, produto, categoria, descricao } = body

  if (!unit_id || !id) return NextResponse.json({ error: 'unit_id e id obrigatórios.' }, { status: 400 })
  if (categoria && !FEEDBACK_CATEGORIAS.includes(categoria)) {
    return NextResponse.json(
      { error: `categoria inválida. Valores aceitos: ${FEEDBACK_CATEGORIAS.join(', ')}.` },
      { status: 400 }
    )
  }

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()
  const relatorio = await getRelatorio(supabase, unit_id, dataParam)
  if (!relatorio) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  if (relatorio.status === 'enviado') return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })

  const { data, error } = await supabase
    .from('op_feedback_cliente')
    .update({
      produto: produto?.trim() ?? null,
      categoria: categoria ?? null,
      texto: descricao?.trim() ?? null,
    })
    .eq('id', id)
    .eq('relatorio_id', relatorio.id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
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

  const { error } = await supabase.from('op_feedback_cliente').delete().eq('id', id).eq('relatorio_id', relatorio.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
