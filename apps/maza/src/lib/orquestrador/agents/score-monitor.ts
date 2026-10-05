import { createServiceClient } from '@maza/db/supabase/server'
import { sendDiscordMessage } from '@/lib/discord/notify'

const SCORE_THRESHOLD = parseInt(process.env.SCORE_THRESHOLD ?? '70', 10)
const JOB_SLUG = 'score_monitor'

// Shapes locais para os resultados das queries do orquestrador.
// hos_jobs e hos_runs ainda não têm inferência completa via SupabaseClient<Database>
// (supabase-js v2 não resolve JSONB em tipos manuais) — seguindo CLAUDE.md §5.5.
type HosJob = { id: string }

type EmpRow = {
  id: string
  nome: string | null
  sobrenome: string | null
  funcao: string | null
  score: number | null
  unit: { name: string } | null
}

type OpenRunPayload = { employee_id?: string }

export async function runScoreMonitor(): Promise<{ created: number }> {
  const supabase = createServiceClient()
  if (!supabase) throw new Error('Supabase indisponível')

  // hos_jobs: tabela do orquestrador, usa as any conforme CLAUDE.md §5.5
  const { data: job } = await (supabase as any)
    .from('hos_jobs')
    .select('id')
    .eq('slug', JOB_SLUG)
    .eq('is_active', true)
    .single() as { data: HosJob | null }

  if (!job) throw new Error('Job score_monitor não encontrado')

  // employees: tipado em database.ts — sem cast no cliente
  const { data: rawEmployees, error } = await supabase
    .from('employees')
    .select('id, nome, sobrenome, funcao, score, unit:units(name)')
    .eq('ativo', true)
    .lt('score', SCORE_THRESHOLD)
    .not('score', 'is', null)

  if (error) throw new Error(error.message)

  const employees = (rawEmployees ?? []) as unknown as EmpRow[]

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

  for (const emp of employees) {
    if (openEmployeeIds.has(emp.id)) continue

    const nomeCompleto = [emp.nome, emp.sobrenome].filter(Boolean).join(' ')
    const unidade = emp.unit?.name ?? 'N/A'
    const funcao = emp.funcao ?? 'N/A'
    const score = emp.score ?? 0
    const delta = SCORE_THRESHOLD - score
    const title = `⚠️ ${nomeCompleto} — score ${score} (abaixo de ${SCORE_THRESHOLD})`

    const { error: insertErr } = await (supabase as any)
      .from('hos_runs')
      .insert({
        job_id: job.id,
        status: 'awaiting_approval',
        triggered_by: 'cron',
        title,
        payload: { employee_id: emp.id, nome: nomeCompleto, funcao, unidade, score, threshold: SCORE_THRESHOLD, delta },
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
      title: 'Score Monitor',
      description: `${created} colaborador(es) com score abaixo de ${SCORE_THRESHOLD} detectado(s).\nAcesse o painel para revisar: ${baseUrl}/orquestrador`,
      color: 0xE74C3C,
    })
  }

  return { created }
}
