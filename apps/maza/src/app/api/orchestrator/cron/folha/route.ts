import { NextRequest } from 'next/server'
import { runFolhaValidator } from '@/lib/orquestrador/agents/folha-validator'

// GET /api/orchestrator/cron/folha
// Protected by Authorization: Bearer <CRON_SECRET>
// Runs on Vercel Cron on the 25th of each month at 08:00 UTC.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runFolhaValidator()
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
