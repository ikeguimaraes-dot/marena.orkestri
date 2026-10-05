import { NextRequest } from 'next/server'
import { createServiceClient } from '@maza/db/supabase/server'
import { sendDiscordMessage, DISCORD_COLORS } from '@/lib/discord/notify'

type EscalationTier = 1 | 2 | 3

function getTier(createdAt: string): EscalationTier | null {
  const hoursElapsed = (Date.now() - new Date(createdAt).getTime()) / 3_600_000
  if (hoursElapsed >= 8) return 3
  if (hoursElapsed >= 4) return 2
  if (hoursElapsed >= 2) return 1
  return null
}

const TIER_LABEL: Record<EscalationTier, string> = {
  1: 'Aguardando aprovação há mais de 2 horas',
  2: 'URGENTE — Aguardando há mais de 4 horas',
  3: 'CRÍTICO — Aguardando há mais de 8 horas. Ação imediata necessária.',
}

const TIER_COLOR: Record<EscalationTier, number> = {
  1: DISCORD_COLORS.amber,
  2: DISCORD_COLORS.red,
  3: DISCORD_COLORS.red,
}

const TIER_EMOJI: Record<EscalationTier, string> = {
  1: '⚠️',
  2: '🚨',
  3: '🔴',
}

// GET /api/orchestrator/escalate
// Protected by Authorization: Bearer <CRON_SECRET>
// Runs on Vercel Cron every 30 minutes.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return Response.json({ error: 'Supabase indisponível' }, { status: 500 })
  }

  const cutoff = new Date(Date.now() - 2 * 3_600_000).toISOString()

  const { data: runs, error } = await (supabase as any)
    .from('hos_runs')
    .select('id, created_at, result_data, job:hos_jobs(name)')
    .eq('status', 'awaiting_approval')
    .lt('created_at', cutoff)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const escalated: string[] = []

  for (const run of runs ?? []) {
    const tier = getTier(run.created_at)
    if (!tier) continue

    const lastTier: number = run.result_data?.escalation_tier ?? 0
    if (tier <= lastTier) continue // already notified at this level

    const jobName: string = run.job?.name ?? 'Desconhecido'
    const hoursElapsed = Math.floor(
      (Date.now() - new Date(run.created_at).getTime()) / 3_600_000
    )
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    await sendDiscordMessage('orquestrador', {
      title: `${TIER_EMOJI[tier]} Orquestrador HOS — Escalação`,
      description: TIER_LABEL[tier],
      color: TIER_COLOR[tier],
      fields: [
        { name: 'Job', value: jobName, inline: true },
        { name: 'Tempo aguardando', value: `${hoursElapsed}h`, inline: true },
        { name: 'Run ID', value: `\`${run.id}\``, inline: false },
        { name: 'Painel', value: `${baseUrl}/orquestrador/${run.id}`, inline: false },
      ],
      footer: { text: 'Use /aprovar ou /rejeitar no Discord com o Run ID acima' },
      timestamp: new Date().toISOString(),
    })

    await (supabase as any)
      .from('hos_runs')
      .update({
        result_data: {
          ...(run.result_data ?? {}),
          escalation_tier: tier,
          last_escalated_at: new Date().toISOString(),
        },
      })
      .eq('id', run.id)

    escalated.push(run.id)
  }

  return Response.json({ escalated, count: escalated.length })
}
