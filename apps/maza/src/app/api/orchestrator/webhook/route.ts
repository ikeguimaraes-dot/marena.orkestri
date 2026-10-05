import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@maza/db/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendDiscordMessage, DISCORD_COLORS } from '@/lib/discord/notify'
import { autoApproveRun } from '@/lib/orquestrador/actions'

const ALLOWED_PROJECTS = (process.env.ORCHESTRATOR_ALLOWED_PROJECTS || 'maza')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

export async function POST(req: NextRequest) {
  // Fail-closed: ausência da env var → 401 antes de processar o body
  const webhookSecret = process.env.VERCEL_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawBody = await req.text()

  // Vercel Webhooks v1: x-vercel-signature = HMAC-SHA1 do raw body (sem prefixo)
  const sig = req.headers.get('x-vercel-signature') ?? ''
  const expected = createHmac('sha1', webhookSecret).update(rawBody).digest('hex')
  let sigValid = false
  try {
    sigValid = timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    // buffers de tamanhos diferentes lançam — assinatura inválida
  }
  if (!sigValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase indisponível' }, { status: 500 })
  }

  const body = JSON.parse(rawBody)
  const { type, payload } = body

  const projectName = body?.payload?.name || body?.payload?.project?.name
  if (projectName && !ALLOWED_PROJECTS.includes(projectName)) {
    console.log(`[orchestrator] Webhook ignorado, projeto fora do allowlist: ${projectName}`)
    return Response.json({ ignored: true, project: projectName }, { status: 200 })
  }

  const event = type ?? body.event

  if (event !== 'deployment.succeeded') {
    return Response.json({ ignored: true, reason: `evento ${event} ignorado` })
  }
  const deployment_url = payload?.url ? `https://${payload.url}` : body.deployment_url
  const triggered_by = 'webhook'

  const target = payload?.target
  const slug = target === 'production' ? 'deploy_prod' : 'qa_preview'
  const deploymentId: string | undefined = payload?.id

  const { data: job } = await (supabase as any)
    .from('hos_jobs')
    .select('id, name, auto_approve')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!job) {
    return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })
  }

  if (deploymentId) {
    const { data: existing } = await (supabase as any)
      .from('hos_runs')
      .select('id')
      .eq('deployment_id', deploymentId)
      .eq('job_id', job.id)
      .maybeSingle()

    if (existing) {
      console.log(`[orchestrator] Evento duplicado ignorado — deployment_id: ${deploymentId}`)
      return NextResponse.json({ ok: true, skipped: 'duplicate', run_id: existing.id })
    }
  }

  const { data: run, error } = await (supabase as any)
    .from('hos_runs')
    .insert({
      job_id: job.id,
      status: 'awaiting_approval',
      triggered_by,
      deployment_id: deploymentId ?? null,
      payload: { deployment_url, event, raw: payload ?? {} },
      logs: [{ ts: new Date().toISOString(), msg: `Run criado via ${triggered_by} — evento: ${event}` }]
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (job.auto_approve) {
    await autoApproveRun(run.id)
    await sendDiscordMessage('orquestrador', {
      title: '🚀 Deploy auto-aprovado',
      description: `**${job.name}** — job de baixo risco, nenhuma ação necessária.`,
      color: DISCORD_COLORS.green,
      fields: [
        { name: 'Status', value: 'Auto-aprovado ✅', inline: true },
        { name: 'Job ID', value: `\`${run.id}\``, inline: true },
        { name: 'Deploy', value: deployment_url ?? 'N/A', inline: false },
        { name: 'Painel', value: `${baseUrl}/orquestrador/${run.id}`, inline: false },
      ],
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ run_id: run.id, status: 'approved' })
  }

  await sendDiscordMessage('orquestrador', {
    title: '🚀 Deploy aguardando aprovação',
    description: `**${job.name}** — nova execução criada via webhook.`,
    color: DISCORD_COLORS.blue,
    fields: [
      { name: 'Status', value: 'Aguardando aprovação', inline: true },
      { name: 'Job ID', value: `\`${run.id}\``, inline: true },
      { name: 'Evento', value: event ?? 'N/A', inline: true },
      { name: 'Deploy', value: deployment_url ?? 'N/A', inline: false },
      { name: 'Painel', value: `${baseUrl}/orquestrador/${run.id}`, inline: false },
    ],
    footer: { text: 'Use /aprovar ou /rejeitar no Discord com o Job ID acima' },
    timestamp: new Date().toISOString(),
  })

  return NextResponse.json({ run_id: run.id, status: 'awaiting_approval' })
}
