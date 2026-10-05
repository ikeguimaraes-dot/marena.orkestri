import { createServiceClient } from '@maza/db/supabase/server'
import { sendDiscordMessage } from '@/lib/discord/notify'

export async function runFeriasMonitor(): Promise<{ created: number }> {
  const supabase = createServiceClient()
  if (!supabase) throw new Error('Supabase indisponível')

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const doze_meses_atras = new Date(hoje)
  doze_meses_atras.setFullYear(doze_meses_atras.getFullYear() - 1)
  const limiteAdmissao = doze_meses_atras.toISOString().slice(0, 10)

  const { data: job } = await (supabase as any)
    .from('hos_jobs')
    .select('id')
    .eq('slug', 'ferias_monitor')
    .eq('is_active', true)
    .single()

  if (!job) throw new Error('Job ferias_monitor não encontrado')

  // Colaboradores ativos com 12+ meses de empresa
  const { data: employees, error } = await (supabase as any)
    .from('employees')
    .select(`
      id,
      nome,
      sobrenome,
      funcao,
      data_admissao,
      unit:units(name)
    `)
    .eq('ativo', true)
    .lte('data_admissao', limiteAdmissao)

  if (error) throw new Error(error.message)

  // Runs abertos para o mesmo job — base da deduplicação por employee_id
  const { data: openRuns } = await (supabase as any)
    .from('hos_runs')
    .select('payload')
    .eq('job_id', job.id)
    .in('status', ['pending', 'awaiting_approval'])

  const openEmployeeIds = new Set<string>(
    (openRuns ?? []).map((r: any) => r.payload?.employee_id as string)
  )

  // Férias não-canceladas nos últimos 12 meses, agrupadas por employee_id
  const { data: feriasRecentes } = await (supabase as any)
    .from('vacations')
    .select('employee_id')
    .gte('start_date', limiteAdmissao)
    .neq('status', 'cancelada')

  const comFeriasRecentes = new Set<string>(
    (feriasRecentes ?? []).map((v: any) => v.employee_id as string)
  )

  let created = 0

  for (const emp of employees ?? []) {
    if (openEmployeeIds.has(emp.id)) continue
    if (comFeriasRecentes.has(emp.id)) continue

    const admissao = new Date(emp.data_admissao)
    const mesesEmpresa = Math.floor(
      (hoje.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    )
    const nomeCompleto = [emp.nome, emp.sobrenome].filter(Boolean).join(' ')
    const unidade = emp.unit?.name ?? 'N/A'
    const funcao = emp.funcao ?? 'N/A'
    const title = `🏖️ ${nomeCompleto} — ${mesesEmpresa} meses sem férias agendadas`

    const { error: insertErr } = await (supabase as any)
      .from('hos_runs')
      .insert({
        job_id: job.id,
        status: 'awaiting_approval',
        triggered_by: 'cron',
        title,
        payload: {
          employee_id: emp.id,
          nome: nomeCompleto,
          funcao,
          unidade,
          data_admissao: emp.data_admissao,
          meses_empresa: mesesEmpresa,
        },
        logs: [{ ts: new Date().toISOString(), msg: title }],
      })

    if (!insertErr) {
      openEmployeeIds.add(emp.id)
      created++
    }
  }

  if (created > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await sendDiscordMessage('orquestrador', {
      title: 'Férias Monitor',
      description: `${created} colaborador(es) sem férias agendadas detectado(s).\nAcesse o painel para revisar: ${baseUrl}/orquestrador`,
      color: 0x3498DB,
    })
  }

  return { created }
}
