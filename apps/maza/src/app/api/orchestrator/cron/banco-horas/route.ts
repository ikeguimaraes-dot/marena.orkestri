import { NextRequest } from 'next/server'
import { runBancoHorasMonitor } from '@/lib/orquestrador/agents/banco-horas-monitor'

// GET /api/orchestrator/cron/banco-horas
// Protected by Authorization: Bearer <CRON_SECRET>
// Runs on Vercel Cron every Monday at 08:45 UTC.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runBancoHorasMonitor()
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
