import { createServiceClient } from '@maza/db/supabase/server'
import { sendDiscordMessage } from '@/lib/discord/notify'

export async function runComplianceDocumental(): Promise<{ created: number }> {
  const supabase = createServiceClient()
  if (!supabase) throw new Error('Supabase indisponível')

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const em30Dias = new Date(hoje.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)

  const { data: job } = await (supabase as any)
    .from('hos_jobs')
    .select('id')
    .eq('slug', 'compliance_documental')
    .eq('is_active', true)
    .single()

  if (!job) throw new Error('Job compliance_documental não encontrado')

  // Documentos vencidos ou vencendo em até 30 dias
  const { data: docs, error } = await (supabase as any)
    .from('employee_documents')
    .select(`
      id,
      employee_id,
      tipo,
      data_validade,
      employee:employees(nome, sobrenome, funcao, unit:units(name))
    `)
    .not('data_validade', 'is', null)
    .lte('data_validade', em30Dias)

  if (error) throw new Error(error.message)

  // Runs abertos para o mesmo job — base da deduplicação por employee+tipo
  const { data: openRuns } = await (supabase as any)
    .from('hos_runs')
    .select('payload')
    .eq('job_id', job.id)
    .in('status', ['pending', 'awaiting_approval'])

  const openKeys = new Set<string>(
    (openRuns ?? []).map((r: any) => `${r.payload?.employee_id}::${r.payload?.tipo}`)
  )

  let created = 0

  for (const doc of docs ?? []) {
    const dedupeKey = `${doc.employee_id}::${doc.tipo}`
    if (openKeys.has(dedupeKey)) continue

    const validade = new Date(doc.data_validade)
    const diasRestantes = Math.ceil((validade.getTime() - hoje.getTime()) / 86_400_000)
    const vencido = diasRestantes < 0

    const nomeCompleto = [doc.employee?.nome, doc.employee?.sobrenome].filter(Boolean).join(' ')
    const unidade = doc.employee?.unit?.name ?? 'N/A'
    const funcao = doc.employee?.funcao ?? 'N/A'

    const urgencia = vencido
      ? 'VENCIDO'
      : `vence em ${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}`
    const title = `📄 ${nomeCompleto} — ${doc.tipo} ${urgencia}`

    const { error: insertErr } = await (supabase as any)
      .from('hos_runs')
      .insert({
        job_id: job.id,
        status: 'awaiting_approval',
        triggered_by: 'cron',
        title,
        payload: {
          employee_id: doc.employee_id,
          document_type: doc.tipo,
          expires_at: doc.data_validade,
          days_remaining: diasRestantes,
          unit: unidade,
          employee_nome: nomeCompleto,
          employee_funcao: funcao,
          vencido,
        },
        logs: [{ ts: new Date().toISOString(), msg: title }],
      })

    if (!insertErr) {
      openKeys.add(dedupeKey)
      created++
    }
  }

  if (created > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await sendDiscordMessage('orquestrador', {
      title: 'Compliance Documental',
      description: `${created} alerta(s) gerado(s).\nAcesse o painel para revisar: ${baseUrl}/orquestrador`,
      color: 0xF39C12,
    })
  }

  return { created }
}
