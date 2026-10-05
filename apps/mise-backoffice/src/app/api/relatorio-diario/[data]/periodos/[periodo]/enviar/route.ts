import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canAccessUnit } from '@/app/api/relatorio-diario/_auth'
import { emitTurnoEvent } from '@/app/api/relatorio-diario/_ledger'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ data: string; periodo: string }> }
) {
  const { data: dataParam, periodo } = await params
  const body = await request.json()
  const { unit_id, sequencia: seqRaw } = body
  const sequencia: number = typeof seqRaw === 'number' ? seqRaw : 1

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()

  // 1. Buscar config da unidade — para determinar períodos-base obrigatórios
  const { data: unitConfig } = await supabase
    .from('op_unit_config')
    .select('periodos')
    .eq('unit_id', unit_id)
    .single()

  // Períodos-base: almoco/jantar (e manha se a unidade tiver). eventos são sempre opcionais.
  const basePeriodos = ((unitConfig?.periodos as string[] | null) ?? ['almoco', 'jantar'])
    .filter(p => p !== 'eventos')

  // 2. Buscar relatorio
  const { data: relatorio } = await supabase
    .from('op_relatorio_diario')
    .select('id, status')
    .eq('unit_id', unit_id)
    .eq('data', dataParam)
    .single()

  if (!relatorio) {
    return NextResponse.json({ error: 'Relatório não encontrado. Reabra a página e tente novamente.' }, { status: 404 })
  }
  if (relatorio.status === 'enviado') {
    return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })
  }

  // 3. Buscar período — save-then-submit: deve existir (autosave garantiu isso)
  const { data: per } = await supabase
    .from('op_relatorio_periodo')
    .select('id, enviado_em')
    .eq('relatorio_id', relatorio.id)
    .eq('periodo', periodo)
    .eq('sequencia', sequencia)
    .single()

  if (!per) {
    return NextResponse.json(
      { error: 'Período não encontrado no banco. Aguarde o salvamento e tente novamente.' },
      { status: 404 }
    )
  }
  if (per.enviado_em) {
    return NextResponse.json({ error: 'Período já enviado.' }, { status: 409 })
  }

  // 4. Resolver user_id do funcionário — enviado_por faz FK para auth.users, não employees
  const { data: emp } = await supabase
    .from('employees')
    .select('user_id')
    .eq('id', auth.employeeId)
    .single()
  const userId: string | null = emp?.user_id ?? null
  if (!userId) {
    // Dívida técnica: 100% dos funcionários de MEE/MP têm user_id null (2026-08-24).
    // Continua sem travar; rastrear via: WHERE enviado_por IS NULL AND enviado_em IS NOT NULL
    // em op_relatorio_periodo. Reverter para bloqueio quando employees.user_id for vinculado.
    console.warn('[TURNO] enviado_por null — employee sem user_id', {
      employeeId: auth.employeeId,
      unitId: unit_id,
      data: dataParam,
      periodo,
    })
  }

  const agora = new Date().toISOString()
  const updateFields: Record<string, unknown> = { enviado_em: agora, status: 'enviado' }
  if (userId) updateFields.enviado_por = userId

  const { error: errPer } = await supabase
    .from('op_relatorio_periodo')
    .update(updateFields)
    .eq('id', per.id)

  if (errPer) return NextResponse.json({ error: errPer.message }, { status: 500 })

  // 5. Verificar se TODOS os períodos estão satisfeitos.
  // Regra: (a) todos os períodos-base (almoco/jantar/manha da config) têm linha
  // com enviado_em ou nao_se_aplica; E (b) todas as linhas existentes no relatório
  // (incluindo eventos extras) estão enviadas ou N/A.
  const { data: todosPeriodos } = await supabase
    .from('op_relatorio_periodo')
    .select('periodo, sequencia, enviado_em, status')
    .eq('relatorio_id', relatorio.id)

  const todosExistentesOk = (todosPeriodos?.length ?? 0) > 0 &&
    todosPeriodos!.every(p => p.enviado_em || p.status === 'nao_se_aplica')

  const basePeriodosOk = basePeriodos.every(tipo =>
    todosPeriodos?.some(p =>
      p.periodo === tipo && (p.enviado_em || p.status === 'nao_se_aplica')
    )
  )

  const todosEnviados = todosExistentesOk && basePeriodosOk

  // 6. Sempre emite turno.period.closed para o período recém-enviado
  await emitTurnoEvent({
    type: 'turno.period.closed',
    unitId: unit_id,
    entityId: per.id,
    actorId: auth.employeeId,
    occurredAt: agora,
    payload: { periodo, data: dataParam },
  })

  // 7. Fechar o dia e emitir turno.closed se todos os períodos estão enviados
  if (todosEnviados) {
    const relUpdate: Record<string, unknown> = { status: 'enviado', enviado_em: agora }
    if (userId) relUpdate.enviado_por = userId
    await supabase
      .from('op_relatorio_diario')
      .update(relUpdate)
      .eq('id', relatorio.id)

    await emitTurnoEvent({
      type: 'turno.closed',
      unitId: unit_id,
      entityId: relatorio.id,
      actorId: auth.employeeId,
      occurredAt: agora,
      payload: { data: dataParam },
    })
  }

  return NextResponse.json({ ok: true, diaClosed: todosEnviados })
}
