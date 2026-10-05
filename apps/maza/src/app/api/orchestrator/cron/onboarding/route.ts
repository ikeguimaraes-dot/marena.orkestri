import { NextRequest } from 'next/server'
import { runOnboardingChecker } from '@/lib/orquestrador/agents/onboarding-checker'

// GET /api/orchestrator/cron/onboarding
// Protected by Authorization: Bearer <CRON_SECRET>
// Runs every day at 09:00 UTC.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runOnboardingChecker()
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
