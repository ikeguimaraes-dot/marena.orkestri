import { NextRequest, after } from 'next/server'
import { verifyDiscordSignature } from '@/lib/discord/verify'
import { submitRunDecisionFromDiscord } from '@/lib/orquestrador/actions'
import { executeCommander } from '@/lib/orquestrador/commander'
import { executeMarenaAgent } from '@/lib/orquestrador/maza-agents'

// Discord interaction types
const PING = 1
const APPLICATION_COMMAND = 2

// Discord response types
const PONG = 1
const CHANNEL_MESSAGE_WITH_SOURCE = 4

const EPHEMERAL = 64

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature-ed25519') ?? ''
  const timestamp = req.headers.get('x-signature-timestamp') ?? ''
  const publicKey = process.env.DISCORD_PUBLIC_KEY ?? ''

  console.log('[discord/interactions] --- verificação de assinatura ---')
  console.log('[discord/interactions] x-signature-ed25519:', signature ? `${signature.slice(0, 16)}… (${signature.length} chars)` : '(ausente)')
  console.log('[discord/interactions] x-signature-timestamp:', timestamp || '(ausente)')
  console.log('[discord/interactions] DISCORD_PUBLIC_KEY configurada:', !!publicKey, publicKey ? `(${publicKey.length} chars)` : '')
  console.log('[discord/interactions] rawBody primeiros 100 chars:', rawBody.slice(0, 100))
  console.log('[discord/interactions] rawBody byte length:', Buffer.byteLength(rawBody, 'utf8'))

  if (!publicKey) {
    console.error('[discord/interactions] DISCORD_PUBLIC_KEY não configurada')
    return new Response('Server misconfigured', { status: 500 })
  }

  const valid = await verifyDiscordSignature(publicKey, signature, timestamp, rawBody)
  console.log('[discord/interactions] resultado da verificação:', valid)
  if (!valid) {
    return new Response('Invalid request signature', { status: 401 })
  }

  const body = JSON.parse(rawBody)

  // Discord PING handshake
  if (body.type === PING) {
    return json({ type: PONG })
  }

  // Slash commands
  if (body.type === APPLICATION_COMMAND) {
    const commandName: string = body.data?.name ?? ''
    const runId: string = body.data?.options?.find((o: any) => o.name === 'run_id')?.value ?? ''
    const discordUser: string =
      body.member?.user?.username ?? body.user?.username ?? 'unknown'

    if (commandName === 'hos') {
      const pergunta = body.data?.options?.find((o: any) => o.name === 'pergunta')?.value ?? 'Olá'
      const token = body.token
      after(async () => {
        await executeCommander(pergunta, token)
      })
      return Response.json({ type: 5 }) // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    }

    // MARENA AI Agent commands — all deferred (async via after())
    const MARENA_AGENT_COMMANDS: Record<string, string> = {
      financeiro: 'dados',
      cardapio: 'itens',
      copy: 'texto',
      conteudo: 'marca',
      operacao: 'marca',
      aprender: 'contexto',
    }

    if (commandName in MARENA_AGENT_COMMANDS) {
      const inputOption = MARENA_AGENT_COMMANDS[commandName]!
      const input: string = body.data?.options?.find((o: any) => o.name === inputOption)?.value ?? ''
      const token: string = body.token
      after(async () => {
        await executeMarenaAgent(commandName, input, token)
      })
      return Response.json({ type: 5 }) // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    }

    if (!['aprovar', 'rejeitar'].includes(commandName)) {
      return json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: '❌ Comando desconhecido.', flags: EPHEMERAL } })
    }

    if (!runId) {
      return json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: '❌ Informe o `run_id`.', flags: EPHEMERAL } })
    }

    const decision = commandName === 'aprovar' ? 'approve' : ('reject' as const)
    const result = await submitRunDecisionFromDiscord(runId, decision, discordUser)

    // Also attempt post-approval action for orquestrador_jobs (fire-and-forget)
    if (decision === 'approve' && process.env.MARENA_API_SECRET) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      fetch(`${baseUrl}/api/orquestrador/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: runId,
          secret: process.env.MARENA_API_SECRET,
        }),
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json() as { action_taken?: string; message?: string }
          console.log(`[discord/aprovar] post-approval action: ${data.action_taken} — ${data.message}`)
        }
      }).catch(() => {/* silencioso — orquestrador_job não encontrado é caso normal */})
    }

    if (!result.ok) {
      return json({
        type: CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `❌ **Erro:** ${result.error}`, flags: EPHEMERAL },
      })
    }

    const emoji = decision === 'approve' ? '✅' : '❌'
    const label = decision === 'approve' ? 'Aprovado' : 'Rejeitado'
    return json({
      type: CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `${emoji} **${label}** por @${discordUser}\n> Run: \`${runId}\``,
      },
    })
  }

  // Unknown type — acknowledge silently
  return json({ type: PONG })
}
