// POST /api/agents/run — receives agent run reports from GitHub Actions.
// Authenticated with MARENA_API_SECRET env var.
// Inserts into agent_runs table in Supabase.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@maza/db/supabase/server'

type RunPayload = {
  agent_name: string
  category: string
  status: 'completed' | 'skipped' | 'failed'
  duration_seconds?: number
  output_summary?: string
  week_number: number
  year: number
  secret: string
}

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = (await request.json()) as RunPayload

  // Auth check
  const expectedSecret = process.env.MARENA_API_SECRET
  if (!expectedSecret || body.secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { agent_name, category, status, duration_seconds, output_summary, week_number, year } = body

  if (!agent_name || !category || !status || !week_number || !year) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase indisponível' }, { status: 500 })
  }

  const { data, error } = await (supabase as any)
    .from('agent_runs')
    .insert({
      agent_name,
      category,
      status,
      duration_seconds: duration_seconds ?? null,
      output_summary: output_summary ?? null,
      week_number,
      year,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[/api/agents/run] insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: (data as { id: string }).id })
}
