import { NextRequest } from 'next/server'
import { runScoreMonitor } from '@/lib/orquestrador/agents/score-monitor'

// GET /api/orchestrator/cron/score
// Protected by Authorization: Bearer <CRON_SECRET>
// Runs on Vercel Cron every Monday at 08:30 UTC.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runScoreMonitor()
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
