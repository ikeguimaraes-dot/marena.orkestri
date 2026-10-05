import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canAccessUnit } from '@/app/api/relatorio-diario/_auth'

// Alterna o status "não se aplica" de um período específico de um dia.
// Body: { unit_id, aplicar: boolean } — aplicar=true marca nao_se_aplica,
// aplicar=false volta para rascunho. Períodos já enviados não podem ser
// marcados como N/A.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ data: string; periodo: string }> }
) {
  const { data: dataParam, periodo } = await params
  const body = await request.json()
  const { unit_id, aplicar, sequencia: seqRaw, motivo } = body
  const sequencia: number = typeof seqRaw === 'number' ? seqRaw : 1

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })
  if (aplicar && !motivo?.trim()) {
    return NextResponse.json({ error: 'Informe o motivo.' }, { status: 400 })
  }

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()

  const { data: relatorio } = await supabase
    .from('op_relatorio_diario')
    .select('id, status')
    .eq('unit_id', unit_id)
    .eq('data', dataParam)
    .single()

  if (!relatorio) {
    return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  }
  if (relatorio.status === 'enviado') {
    return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })
  }

  // Não deixar marcar N/A um período que já foi enviado.
  const { data: existente } = await supabase
    .from('op_relatorio_periodo')
    .select('id, enviado_em')
    .eq('relatorio_id', relatorio.id)
    .eq('periodo', periodo)
    .eq('sequencia', sequencia)
    .maybeSingle()

  if (aplicar && existente?.enviado_em) {
    return NextResponse.json({ error: 'Período já enviado não pode ser marcado como não se aplica.' }, { status: 409 })
  }

  const novoStatus = aplicar ? 'nao_se_aplica' : 'rascunho'

  const { error } = await supabase
    .from('op_relatorio_periodo')
    .upsert(
      { relatorio_id: relatorio.id, periodo, sequencia, status: novoStatus, na_motivo: aplicar ? motivo.trim() : null },
      { onConflict: 'relatorio_id,periodo,sequencia' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, status: novoStatus })
}
