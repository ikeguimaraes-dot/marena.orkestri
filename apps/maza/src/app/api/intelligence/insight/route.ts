import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPTS: Record<string, string> = {
  dashboard: `Você é o analista executivo da Marena, um ERP de gestão empresarial. Analise os dados do painel geral e gere um insight executivo conciso. Responda APENAS com JSON válido no formato: {"headline": "string (máx 120 chars, assertivo e direto)", "insights": ["string", "string", "string"], "proximo_passo": "string (máx 120 chars, ação concreta)"}. Não use markdown, não use blocos de código, retorne apenas o JSON cru.`,

  financeiro: `Você é o CFO virtual da Marena. Analise os dados financeiros (DRE, CMV, EBITDA, receita) e gere um insight executivo. Benchmarks: CMV ≤ 28% (alerta > 32%), EBITDA ≥ 18% (alerta < 12%). Responda APENAS com JSON válido: {"headline": "string (máx 120 chars)", "insights": ["string", "string", "string"], "proximo_passo": "string (máx 120 chars)"}. JSON cru sem markdown.`,

  metas: `Você é o analista de performance da Marena. Analise o progresso em relação às metas estratégicas e OKRs. Identifique gaps e riscos. Responda APENAS com JSON válido: {"headline": "string (máx 120 chars)", "insights": ["string", "string", "string"], "proximo_passo": "string (máx 120 chars)"}. JSON cru sem markdown.`,

  pessoas: `Você é o CHRO virtual da Marena. Analise os dados de headcount, turnover, afastamentos e horas extras. Destaque riscos trabalhistas. Responda APENAS com JSON válido: {"headline": "string (máx 120 chars)", "insights": ["string", "string", "string"], "proximo_passo": "string (máx 120 chars)"}. JSON cru sem markdown.`,

  operacao: `Você é o COO virtual da Marena. Analise os dados operacionais (eventos, ocupação, cobertura de turnos, alertas). Foque em gargalos e oportunidades imediatas. Responda APENAS com JSON válido: {"headline": "string (máx 120 chars)", "insights": ["string", "string", "string"], "proximo_passo": "string (máx 120 chars)"}. JSON cru sem markdown.`,

  orquestrador: `Você é o arquiteto de automação da Marena. Analise o estado do orquestrador de IA (jobs pendentes, execuções recentes, agentes ativos). Identifique riscos de pipeline. Responda APENAS com JSON válido: {"headline": "string (máx 120 chars)", "insights": ["string", "string", "string"], "proximo_passo": "string (máx 120 chars)"}. JSON cru sem markdown.`,
}

function extractJson(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) return text
  return text.slice(start, end + 1)
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(null, { status: 503 })
  }

  try {
    const { module, context } = (await req.json()) as {
      module: string
      context: Record<string, unknown>
    }

    const systemPrompt = SYSTEM_PROMPTS[module] ?? SYSTEM_PROMPTS.dashboard!
    const userMessage = `Dados atuais do módulo "${module}":\n${JSON.stringify(context, null, 2)}\n\nGere o insight executivo em JSON.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      console.error('[insight] Anthropic error:', response.status)
      return NextResponse.json(null, { status: 500 })
    }

    const aiResponse = await response.json() as { content?: Array<{ type: string; text?: string }> }
    const rawText = aiResponse.content?.[0]?.type === 'text' ? aiResponse.content[0].text ?? '' : ''
    if (!rawText) return NextResponse.json(null, { status: 500 })

    const jsonStr = extractJson(rawText)
    const parsed = JSON.parse(jsonStr)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[insight] error:', err instanceof Error ? err.message : err)
    return NextResponse.json(null, { status: 500 })
  }
}
