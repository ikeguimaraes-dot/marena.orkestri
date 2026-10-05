import { autoApproveRun, updateRunLogs, markRunFailed } from '@/lib/orquestrador/actions'
import { sendDiscordMessage } from '@/lib/discord/notify'

const MAX_DIFF_BYTES = 12_000

export async function executeCodeReview(runId: string, payload: any): Promise<void> {
  try {
    const { pull_request, repository } = payload

    // 1. Busca diff do PR via API (diff_url direta falha em repos privados)
    const diffRes = await fetch(
      `https://api.github.com/repos/${repository.full_name}/pulls/${pull_request.number}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.diff',
        },
      }
    )
    let diff = await diffRes.text()
    if (diff.length > MAX_DIFF_BYTES) {
      diff = diff.slice(0, MAX_DIFF_BYTES) + '\n\n[diff truncado — muito extenso]'
    }

    // 2. Chama Claude API
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `Você é um engenheiro sênior revisando um pull request. Analise o diff e forneça:
1. **Resumo** (2-3 frases sobre o que o PR faz)
2. **Riscos ou problemas** detectados (bullets, ou "Nenhum identificado")
3. **Sugestões** de melhoria (bullets, ou "N/A")
4. **Veredito:** APROVADO / SOLICITAR MUDANÇAS / COMENTÁRIO

Seja direto e construtivo. Responda em português brasileiro.`,
        messages: [
          {
            role: 'user',
            content: `PR #${pull_request.number}: ${pull_request.title}\n\n${diff}`,
          },
        ],
      }),
    })

    const claudeData = await claudeRes.json()
    const review: string = claudeData.content?.[0]?.text ?? 'Sem resposta da Claude API.'

    // 3. Posta comment no PR do GitHub
    await fetch(
      `https://api.github.com/repos/${repository.full_name}/issues/${pull_request.number}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: `## 🤖 Code Review — Orquestrador HOS\n\n${review}`,
        }),
      }
    )

    // 4. Persiste resultado e aprova run
    await updateRunLogs(runId, { review_summary: review.slice(0, 500) })
    await autoApproveRun(runId)

    // 5. Notifica Discord
    await sendDiscordMessage('orquestrador', {
      title: `Code Review concluído — PR #${pull_request.number}`,
      description: `**PR:** ${pull_request.title}\n**Link:** ${pull_request.html_url}`,
      color: 0x2ECC71,
    })
  } catch (err) {
    await markRunFailed(runId, String(err))
    await sendDiscordMessage('orquestrador', {
      title: 'Code Review falhou',
      description: `Run \`${runId}\`\n${String(err)}`,
      color: 0xE74C3C,
    })
  }
}
