import { NextResponse } from 'next/server'
import { createServiceClient } from '@maza/db/supabase/server'
import { autoApproveRun, updateRunLogs } from '@/lib/orquestrador/actions'
import { sendDiscordMessage } from '@/lib/discord/notify'

export async function POST(req: Request) {
  const secret = req.headers.get('x-qa-secret')
  if (secret !== process.env.QA_CALLBACK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { preview_url, results } = await req.json()

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase indisponível' }, { status: 500 })
  }

  // Encontra o run de qa_preview correspondente pela URL de deploy
  const { data: run } = await (supabase as any)
    .from('hos_runs')
    .select('id, status')
    .filter('payload->>deployment_url', 'eq', preview_url)
    .eq('status', 'awaiting_approval')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const passed = (results?.stats?.unexpected ?? 1) === 0
  const total = (results?.stats?.expected ?? 0) + (results?.stats?.unexpected ?? 0)
  const summary = `${results?.stats?.expected ?? 0}/${total} testes passaram`

  if (run) {
    await updateRunLogs(run.id, {
      qa_summary: summary,
      qa_passed: passed,
      qa_details: results,
    })

    if (passed) {
      await autoApproveRun(run.id)
    }
    // Se falhou, o run permanece em awaiting_approval para revisão humana
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const passed_label = passed ? 'QA passou' : 'QA falhou — revisão necessária'
  await sendDiscordMessage('orquestrador', {
    title: passed_label,
    description:
      `${summary}\n**Preview:** ${preview_url}` +
      (run ? `\n**Painel:** ${baseUrl}/orquestrador/${run.id}` : ''),
    color: passed ? 0x2ECC71 : 0xE74C3C,
  })

  return NextResponse.json({ ok: true, passed, summary })
}
