import { createServiceClient } from '@maza/db/supabase/server'
import { sendDiscordMessage } from '@/lib/discord/notify'

const DOCS_OBRIGATORIOS = [
  'rg', 'cpf', 'ctps', 'pis_pasep', 'titulo_eleitor',
  'comprovante_residencia', 'foto_3x4', 'aso_admissional',
]

export async function runOnboardingChecker(): Promise<{ checked: number; pendencias: number }> {
  const supabase = createServiceClient()
  if (!supabase) throw new Error('Supabase indisponível')

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // Janela de 48h centrada no 7º dia após admissão
  const dia6 = new Date(hoje.getTime() - 6 * 86_400_000).toISOString().slice(0, 10)
  const dia8 = new Date(hoje.getTime() - 8 * 86_400_000).toISOString().slice(0, 10)

  const { data: job } = await (supabase as any)
    .from('hos_jobs')
    .select('id')
    .eq('slug', 'onboarding_checker')
    .eq('is_active', true)
    .single()

  if (!job) throw new Error('Job onboarding_checker não encontrado')

  // Colaboradores ativos admitidos entre 6 e 8 dias atrás
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
    .lte('data_admissao', dia6)
    .gte('data_admissao', dia8)

  if (error) throw new Error(error.message)

  // Runs abertos para este job — deduplicação por employee_id
  const { data: openRuns } = await (supabase as any)
    .from('hos_runs')
    .select('payload')
    .eq('job_id', job.id)
    .in('status', ['pending', 'awaiting_approval'])

  const openEmployeeIds = new Set<string>(
    (openRuns ?? []).map((r: any) => r.payload?.employee_id as string)
  )

  let checked = 0
  let pendencias = 0

  for (const emp of employees ?? []) {
    checked++

    if (openEmployeeIds.has(emp.id)) continue

    const { data: docs } = await (supabase as any)
      .from('employee_documents')
      .select('tipo')
      .eq('employee_id', emp.id)

    const tiposPresentes = new Set<string>((docs ?? []).map((d: any) => d.tipo as string))
    const documentosFaltando = DOCS_OBRIGATORIOS.filter(t => !tiposPresentes.has(t))

    if (documentosFaltando.length === 0) continue

    const nomeCompleto = [emp.nome, emp.sobrenome].filter(Boolean).join(' ')
    const unidade = emp.unit?.name ?? 'N/A'
    const funcao = emp.funcao ?? 'N/A'
    const documentosPresentes = DOCS_OBRIGATORIOS.filter(t => tiposPresentes.has(t))

    const title = `📋 Onboarding ${nomeCompleto} — ${documentosFaltando.length} doc(s) pendente(s)`

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
          documentos_faltando: documentosFaltando,
          documentos_presentes: documentosPresentes,
        },
        logs: [{ ts: new Date().toISOString(), msg: title }],
      })

    if (!insertErr) {
      openEmployeeIds.add(emp.id)
      pendencias++
    }
  }

  if (pendencias > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await sendDiscordMessage('orquestrador', {
      title: 'Onboarding Checker',
      description: `${pendencias} colaborador(es) com documentos pendentes.\nAcesse o painel para revisar: ${baseUrl}/orquestrador`,
      color: 0x9B59B6,
    })
  }

  return { checked, pendencias }
}
