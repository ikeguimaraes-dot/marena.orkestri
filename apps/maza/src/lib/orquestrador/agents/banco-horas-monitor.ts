import { createServiceClient } from '@maza/db/supabase/server'
import { sendDiscordMessage } from '@/lib/discord/notify'

const BH_THRESHOLD_MIN = parseInt(process.env.BH_THRESHOLD_HOURS ?? '40', 10) * 60
const JOB_SLUG = 'banco_horas_monitor'

// Shapes locais para os resultados das queries do orquestrador.
// hos_jobs e hos_runs ainda não têm inferência completa via SupabaseClient<Database>
// (supabase-js v2 não resolve JSONB em tipos manuais) — seguindo CLAUDE.md §5.5.
type HosJob = { id: string }

type SaldoRow = {
  employee_id: string
  saldo_minutos: number
  ultimo_calculo: string | null
  employee: {
    nome: string | null
    sobrenome: string | null
    funcao: string | null
    unit: { name: string } | null
  } | null
}

type OpenRunPayload = { employee_id?: string }

function minutesToHHMM(minutos: number): string {
  const h = Math.floor(Math.abs(minutos) / 60)
  const m = Math.abs(minutos) % 60
  const sign = minutos < 0 ? '-' : ''
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export async function runBancoHorasMonitor(): Promise<{ created: number }> {
  const supabase = createServiceClient()
  if (!supabase) throw new Error('Supabase indisponível')

  // hos_jobs: tabela do orquestrador, usa as any conforme CLAUDE.md §5.5
  const { data: job } = await (supabase as any)
    .from('hos_jobs')
    .select('id')
    .eq('slug', JOB_SLUG)
    .eq('is_active', true)
    .single() as { data: HosJob | null }

  if (!job) throw new Error('Job banco_horas_monitor não encontrado')

  // time_bank_balance: tipado em database.ts — sem cast no cliente
  const { data: rawSaldos, error } = await supabase
    .from('time_bank_balance')
    .select('employee_id, saldo_minutos, ultimo_calculo, employee:employees!inner(nome, sobrenome, funcao, unit:units(name))')
    .gt('saldo_minutos', BH_THRESHOLD_MIN)

  if (error) throw new Error(error.message)

  const saldos = (rawSaldos ?? []) as unknown as SaldoRow[]

  // hos_runs: tabela do orquestrador, usa as any conforme CLAUDE.md §5.5
  const { data: openRunsData } = await (supabase as any)
    .from('hos_runs')
    .select('payload')
    .eq('job_id', job.id)
    .in('status', ['pending', 'awaiting_approval']) as { data: { payload: OpenRunPayload | null }[] | null }

  const openEmployeeIds = new Set<string>(
    (openRunsData ?? []).map((r) => r.payload?.employee_id ?? '').filter(Boolean)
  )

  let created = 0
  const thresholdHoras = BH_THRESHOLD_MIN / 60

  for (const s of saldos) {
    if (openEmployeeIds.has(s.employee_id)) continue

    const emp = s.employee
    const nomeCompleto = [emp?.nome, emp?.sobrenome].filter(Boolean).join(' ')
    const unidade = emp?.unit?.name ?? 'N/A'
    const funcao = emp?.funcao ?? 'N/A'
    const saldoHHMM = minutesToHHMM(s.saldo_minutos)
    const saldoHoras = (s.saldo_minutos / 60).toFixed(1)
    const title = `🕐 ${nomeCompleto} — banco de horas ${saldoHHMM} (limite: ${thresholdHoras}h)`

    const { error: insertErr } = await (supabase as any)
      .from('hos_runs')
      .insert({
        job_id: job.id,
        status: 'awaiting_approval',
        triggered_by: 'cron',
        title,
        payload: {
          employee_id: s.employee_id,
          nome: nomeCompleto,
          funcao,
          unidade,
          saldo_minutos: s.saldo_minutos,
          saldo_horas: saldoHoras,
          saldo_formatado: saldoHHMM,
          threshold_horas: thresholdHoras,
          ultimo_calculo: s.ultimo_calculo,
        },
        logs: [{ ts: new Date().toISOString(), msg: title }],
      })

    if (!insertErr) {
      openEmployeeIds.add(s.employee_id)
      created++
    }
  }

  if (created > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await sendDiscordMessage('orquestrador', {
      title: 'Banco de Horas Monitor',
      description: `${created} colaborador(es) com saldo acima de ${thresholdHoras}h detectado(s).\nAcesse o painel para revisar: ${baseUrl}/orquestrador`,
      color: 0xF39C12,
    })
  }

  return { created }
}
