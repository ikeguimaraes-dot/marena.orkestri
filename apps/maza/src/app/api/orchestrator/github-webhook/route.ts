import { after } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createRun } from '@/lib/orquestrador/actions'
import { executeCodeReview } from '@/lib/orquestrador/agents/code-review'

const PR_ACTIONS = new Set(['opened', 'synchronize', 'reopened'])

export async function POST(req: Request) {
  const body = await req.text()

  // Verifica assinatura HMAC do GitHub
  const sig = req.headers.get('x-hub-signature-256') ?? ''
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    return new Response('GITHUB_WEBHOOK_SECRET não configurado', { status: 500 })
  }
  const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  let sigValid = false
  try {
    sigValid = timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    // buffers de tamanhos diferentes lançam — assinatura inválida
  }
  if (!sigValid) {
    return new Response('Unauthorized', { status: 401 })
  }

  const event = req.headers.get('x-github-event')
  const payload = JSON.parse(body)

  if (event !== 'pull_request') {
    return Response.json({ ignored: true, reason: 'not a pull_request event' })
  }
  if (!PR_ACTIONS.has(payload.action)) {
    return Response.json({ ignored: true, reason: `action not tracked: ${payload.action}` })
  }

  const pr = payload.pull_request
  const run = await createRun('code_review', {
    pr_number: pr.number,
    pr_title: pr.title,
    pr_url: pr.html_url,
    repo: payload.repository.full_name,
    diff_url: pr.diff_url,
  })

  after(async () => {
    await executeCodeReview(run.id, payload)
  })

  return Response.json({ run_id: run.id, status: 'running' })
}
