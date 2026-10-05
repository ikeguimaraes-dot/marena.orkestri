import { NextRequest } from 'next/server'

const COMMANDS = [
  // ── Orquestrador HOS ──────────────────────────────────────────────────────
  {
    name: 'hos',
    description: 'Consulta o Orquestrador HOS em linguagem natural',
    options: [
      {
        name: 'pergunta',
        description: 'O que você quer saber? Ex: status dos runs, pendentes, jobs ativos...',
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: 'aprovar',
    description: 'Aprovar uma execução no Orquestrador HOS',
    options: [
      {
        type: 3,
        name: 'run_id',
        description: 'ID da execução (UUID)',
        required: true,
      },
    ],
  },
  {
    name: 'rejeitar',
    description: 'Rejeitar uma execução no Orquestrador HOS',
    options: [
      {
        type: 3,
        name: 'run_id',
        description: 'ID da execução (UUID)',
        required: true,
      },
    ],
  },
  // ── MARENA AI Agents ─────────────────────────────────────────────────────────
  {
    name: 'financeiro',
    description: 'Analisa DRE, CMV, EBITDA ou dados financeiros de qualquer marca MARENA',
    options: [
      {
        type: 3,
        name: 'dados',
        description: 'Ex: "Unidade maio — receita R$280k, CMV food 31%, bebidas 48%, EBITDA 14%"',
        required: true,
      },
    ],
  },
  {
    name: 'cardapio',
    description: 'Engenharia de cardápio — CMV por item, matriz Star/Plow Horse/Puzzle/Dog',
    options: [
      {
        type: 3,
        name: 'itens',
        description: 'Ex: "Filé mignon: custo R$42, preço R$128 | Risoto: custo R$18, preço R$72"',
        required: true,
      },
    ],
  },
  {
    name: 'copy',
    description: 'Valida copy, captions ou textos institucionais contra a voz MARENA/HOS',
    options: [
      {
        type: 3,
        name: 'texto',
        description: 'Cole o texto a ser avaliado',
        required: true,
      },
    ],
  },
  {
    name: 'conteudo',
    description: 'Gera calendário editorial para marca MARENA (Unidade, Unidade, Unidade...)',
    options: [
      {
        type: 3,
        name: 'marca',
        description: 'Ex: "Unidade - junho" ou "Unidade - julho, foco em eventos"',
        required: true,
      },
    ],
  },
  {
    name: 'operacao',
    description: 'Gera Ordem de Serviço (pré-abertura, turno, fechamento) seguindo Método FOME',
    options: [
      {
        type: 3,
        name: 'marca',
        description: 'Ex: "Unidade - pré-abertura jantar" ou "Unidade - fechamento"',
        required: true,
      },
    ],
  },
  {
    name: 'aprender',
    description: 'Analisa o stack MARENA AI e retorna relatório de evolução com gaps e melhorias',
    options: [
      {
        type: 3,
        name: 'contexto',
        description: 'Contexto adicional para análise (opcional)',
        required: false,
      },
    ],
  },
]

// GET /api/discord/register?secret=CRON_SECRET
// Registers slash commands with Discord. Call once after deploy.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appId = process.env.DISCORD_APP_ID
  const botToken = process.env.DISCORD_BOT_TOKEN
  if (!appId || !botToken) {
    return Response.json({ error: 'DISCORD_APP_ID ou DISCORD_BOT_TOKEN não configurados' }, { status: 500 })
  }

  const results = await Promise.all(
    COMMANDS.map((cmd) =>
      fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify(cmd),
      }).then((r) => r.json())
    )
  )

  return Response.json({ registered: results })
}
