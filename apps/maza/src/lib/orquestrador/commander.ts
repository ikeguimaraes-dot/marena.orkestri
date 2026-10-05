import { createServiceClient } from '@maza/db/supabase/server'

const SYSTEM_PROMPT = `Você é o Assistente do Orquestrador da Marena.
Responda de forma concisa e direta. Use formatação Discord (**negrito**, \`código\`).
Você está conversando com o founder via Discord.`

const TOOLS = [
  {
    name: 'get_system_status',
    description: 'Estatísticas dos runs dos últimos 7 dias: total, por status, por job',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_pending_runs',
    description: 'Lista runs aguardando aprovação, mais recentes primeiro',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'máximo de runs, default 5' } },
    },
  },
  {
    name: 'get_run_details',
    description: 'Detalhes de um run específico pelo ID',
    input_schema: {
      type: 'object',
      properties: { run_id: { type: 'string' } },
      required: ['run_id'],
    },
  },
  {
    name: 'get_jobs',
    description: 'Lista todos os jobs e seus status (auto_approve, is_active)',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
]

export async function executeCommander(pergunta: string, interactionToken: string) {
  const supabase = createServiceClient()
  if (!supabase) {
    await patchInteraction(interactionToken, '⚠️ Banco de dados indisponível.')
    return
  }

  const messages: any[] = [{ role: 'user', content: pergunta }]

  for (let i = 0; i < 5; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      }),
    })
    const data = await res.json()

    if (data.stop_reason === 'end_turn') {
      const text = data.content?.find((c: any) => c.type === 'text')?.text ?? 'Sem resposta.'
      await patchInteraction(interactionToken, text)
      return
    }

    if (data.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: data.content })
      const toolResults: any[] = []

      for (const block of data.content ?? []) {
        if (block.type !== 'tool_use') continue
        let result: any = {}

        if (block.name === 'get_system_status') {
          const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
          const { data: runs } = await (supabase as any)
            .from('hos_runs')
            .select('status, created_at, hos_jobs(name)')
            .gte('created_at', since)
            .is('archived_at', null)
          const byStatus = (runs ?? []).reduce((acc: any, r: any) => {
            acc[r.status] = (acc[r.status] ?? 0) + 1
            return acc
          }, {})
          const byJob = (runs ?? []).reduce((acc: any, r: any) => {
            const job = r.hos_jobs?.name ?? 'desconhecido'
            acc[job] = (acc[job] ?? 0) + 1
            return acc
          }, {})
          result = { total: runs?.length ?? 0, by_status: byStatus, by_job: byJob, period: 'últimos 7 dias' }
        }

        if (block.name === 'list_pending_runs') {
          const limit = block.input?.limit ?? 5
          const { data: runs } = await (supabase as any)
            .from('hos_runs')
            .select('id, created_at, deployment_id, payload, hos_jobs(name)')
            .eq('status', 'awaiting_approval')
            .is('archived_at', null)
            .order('created_at', { ascending: false })
            .limit(limit)
          result = {
            runs: (runs ?? []).map((r: any) => ({
              run_id: r.id,
              job: r.hos_jobs?.name ?? 'desconhecido',
              criado: new Date(r.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
              deploy_url: r.payload?.deployment_url ?? r.payload?.url ?? '',
              aprovar: `/aprovar run_id:${r.id}`,
              rejeitar: `/rejeitar run_id:${r.id}`,
            })),
          }
        }

        if (block.name === 'get_run_details') {
          const { data: run } = await (supabase as any)
            .from('hos_runs')
            .select('id, status, created_at, updated_at, deployment_id, logs, result_data, payload, hos_jobs(name, slug)')
            .eq('id', block.input.run_id)
            .single()
          if (!run) {
            result = { error: 'Run não encontrado' }
          } else {
            result = {
              run_id: run.id,
              job: run.hos_jobs?.name ?? 'desconhecido',
              slug: run.hos_jobs?.slug ?? '',
              status: run.status,
              deployment_id: run.deployment_id ?? null,
              deploy_url: run.payload?.deployment_url ?? run.payload?.url ?? '',
              criado: new Date(run.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
              atualizado: new Date(run.updated_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
              logs: run.logs,
              result_data: run.result_data,
              aprovar: `/aprovar run_id:${run.id}`,
              rejeitar: `/rejeitar run_id:${run.id}`,
            }
          }
        }

        if (block.name === 'get_jobs') {
          const { data: jobs } = await (supabase as any)
            .from('hos_jobs')
            .select('name, slug, auto_approve, is_active')
          result = { jobs: jobs ?? [] }
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }
      messages.push({ role: 'user', content: toolResults })
    }
  }

  await patchInteraction(interactionToken, '⚠️ Não consegui processar a pergunta. Tenta de novo.')
}

async function patchInteraction(token: string, content: string) {
  await fetch(
    `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APP_ID}/${token}/messages/@original`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 2000) }),
    }
  )
}
