import { NextRequest } from 'next/server'
import { runComplianceDocumental } from '@/lib/orquestrador/agents/compliance-documental'

// GET /api/orchestrator/cron/compliance
// Protected by Authorization: Bearer <CRON_SECRET>
// Runs on Vercel Cron daily at 08:00 UTC.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runComplianceDocumental()
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
