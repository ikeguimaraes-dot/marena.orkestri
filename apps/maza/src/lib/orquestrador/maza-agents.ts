/**
 * MARENA AI Agents — Discord slash command handlers
 *
 * Each agent uses the system prompt from ~/.claude/agents/*.md (embedded here
 * because those files are not available on Vercel at runtime).
 *
 * All calls use claude-sonnet-4-20250514 per CLAUDE.md orchestrator convention.
 * Responses are truncated to 1950 chars for Discord's 2000-char limit.
 */

const DISCORD_MAX = 1950
const MODEL = 'claude-sonnet-4-20250514'

// ─── System prompts (stripped of YAML frontmatter) ───────────────────────────

const PROMPT_FINANCEIRO = `Você é o assistente de análise financeira e DRE da Marena. Use exclusivamente os dados fornecidos pelo usuário. Não presuma unidades, responsáveis, metas, benchmarks ou valores históricos. Diferencie fatos de hipóteses, informe quando faltar informação e apresente recomendações em português brasileiro. Não invente números ou acessos a sistemas e não execute ações externas sem autorização.`;

const PROMPT_CARDAPIO = `Você é o assistente de engenharia de cardápio da Marena. Use exclusivamente os dados fornecidos pelo usuário. Não presuma unidades, responsáveis, metas, benchmarks ou valores históricos. Diferencie fatos de hipóteses, informe quando faltar informação e apresente recomendações em português brasileiro. Não invente números ou acessos a sistemas e não execute ações externas sem autorização.`;

const PROMPT_COPY = `Você é o assistente de revisão de texto e identidade da marca da Marena. Use exclusivamente os dados fornecidos pelo usuário. Não presuma unidades, responsáveis, metas, benchmarks ou valores históricos. Diferencie fatos de hipóteses, informe quando faltar informação e apresente recomendações em português brasileiro. Não invente números ou acessos a sistemas e não execute ações externas sem autorização.`;

const PROMPT_CONTEUDO = `Você é o assistente de planejamento de conteúdo da Marena. Use exclusivamente os dados fornecidos pelo usuário. Não presuma unidades, responsáveis, metas, benchmarks ou valores históricos. Diferencie fatos de hipóteses, informe quando faltar informação e apresente recomendações em português brasileiro. Não invente números ou acessos a sistemas e não execute ações externas sem autorização.`;

const PROMPT_OPERACAO = `Você é o assistente de checklists operacionais da Marena. Use exclusivamente os dados fornecidos pelo usuário. Não presuma unidades, responsáveis, metas, benchmarks ou valores históricos. Diferencie fatos de hipóteses, informe quando faltar informação e apresente recomendações em português brasileiro. Não invente números ou acessos a sistemas e não execute ações externas sem autorização.`;

const PROMPT_APRENDER = `Você é o assistente de melhoria contínua do sistema da Marena. Use exclusivamente os dados fornecidos pelo usuário. Não presuma unidades, responsáveis, metas, benchmarks ou valores históricos. Diferencie fatos de hipóteses, informe quando faltar informação e apresente recomendações em português brasileiro. Não invente números ou acessos a sistemas e não execute ações externas sem autorização.`;

const AGENTS: Record<string, { prompt: string; intro: string }> = {
  financeiro: {
    prompt: PROMPT_FINANCEIRO,
    intro: '💰 **Financial Reviewer** analisando dados...',
  },
  cardapio: {
    prompt: PROMPT_CARDAPIO,
    intro: '📊 **Menu Engineer** calculando CMV e matriz...',
  },
  copy: {
    prompt: PROMPT_COPY,
    intro: '✍️ **Brand Checker** avaliando copy...',
  },
  conteudo: {
    prompt: PROMPT_CONTEUDO,
    intro: '📅 **Social Planner** gerando calendário...',
  },
  operacao: {
    prompt: PROMPT_OPERACAO,
    intro: '📋 **Ops Checklist** gerando Ordem de Serviço...',
  },
  aprender: {
    prompt: PROMPT_APRENDER,
    intro: '🧠 **Learning Machine** analisando stack MARENA AI...',
  },
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function executeMarenaAgent(
  agentKey: string,
  input: string,
  interactionToken: string
): Promise<void> {
  const agent = AGENTS[agentKey]
  if (!agent) {
    await patchInteraction(interactionToken, `❌ Agente desconhecido: \`${agentKey}\``)
    return
  }

  const userMessage =
    input.trim() ||
    (agentKey === 'aprender'
      ? 'Analise o estado atual do stack MARENA AI e retorne o relatório de evolução.'
      : 'Análise geral.')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: agent.prompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      await patchInteraction(interactionToken, `❌ Erro da API (${res.status}): ${err.slice(0, 200)}`)
      return
    }

    const data = await res.json()
    const text: string = data.content?.find((c: any) => c.type === 'text')?.text ?? '⚠️ Sem resposta.'

    const reply =
      text.length > DISCORD_MAX
        ? text.slice(0, DISCORD_MAX) + '\n\n_... resultado completo disponível no Marena_'
        : text

    await patchInteraction(interactionToken, reply)
  } catch (err) {
    await patchInteraction(
      interactionToken,
      `❌ Erro ao executar agente \`${agentKey}\`: ${String(err).slice(0, 200)}`
    )
  }
}

// ─── Discord interaction helper ───────────────────────────────────────────────

async function patchInteraction(token: string, content: string): Promise<void> {
  await fetch(
    `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APP_ID}/${token}/messages/@original`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 2000) }),
    }
  )
}
