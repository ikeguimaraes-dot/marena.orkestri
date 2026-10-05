// Post-approval action handlers for orquestrador_jobs.
// Routes by job.type and executes the corresponding automation.

import { createServiceClient } from '@maza/db/supabase/server'
import { sendDiscordMessage, DISCORD_COLORS } from '@/lib/discord/notify'

export type ApprovalResult = {
  success: boolean
  message: string
  action_taken: string
}

// ── Main router ────────────────────────────────────────────────────────

export async function handleApproval(jobId: string): Promise<ApprovalResult> {
  const supabase = createServiceClient()
  if (!supabase) {
    return { success: false, message: 'Supabase indisponível', action_taken: 'none' }
  }

  const { data: job, error } = await (supabase as any)
    .from('orquestrador_jobs')
    .select('id, type, status, payload, result')
    .eq('id', jobId)
    .single()

  if (error || !job) {
    return { success: false, message: 'Job não encontrado', action_taken: 'none' }
  }

  let result: ApprovalResult

  switch ((job as any).type) {
    case 'deploy_prod':
      result = await handleDeployApproval(job as any)
      break
    case 'learning_machine_weekly':
      result = await handleLearningMachineApproval(job as any)
      break
    case 'alert_generated':
      result = await handleAlertApproval(job as any)
      break
    case 'feedback_received':
      result = await handleFeedbackApproval(job as any)
      break
    default:
      result = {
        success: false,
        message: `Tipo de job não suportado: ${(job as any).type}`,
        action_taken: 'none',
      }
  }

  // Persist execution result
  await (supabase as any)
    .from('orquestrador_jobs')
    .update({
      executed_at: new Date().toISOString(),
      execution_result: result,
    })
    .eq('id', jobId)

  return result
}

// ── Task 3 — deploy_prod ───────────────────────────────────────────────
// NOTE: Requires VERCEL_TOKEN env var.
// Add to Vercel: Settings → Environment Variables → VERCEL_TOKEN
// Value: your Vercel personal access token (vercel.com/account/tokens)

async function handleDeployApproval(job: {
  id: string
  payload: { deployment_url?: string; deployment_id?: string }
}): Promise<ApprovalResult> {
  const deploymentUrl: string = job.payload?.deployment_url ?? ''
  const vercelToken = process.env.VERCEL_TOKEN

  // Extract deployment ID from URL or payload
  let deploymentId: string | null = job.payload?.deployment_id ?? null
  if (!deploymentId && deploymentUrl) {
    // Format: http://localhost:3000
    const match = deploymentUrl.match(/https:\/\/([^.]+)\.vercel\.app/)
    if (match) {
      // The full subdomain is the deployment alias; the ID is in the inspectorUrl
      // Try extracting from the URL slug pattern maza-XXXXX-henriques...
      const slugMatch = match[1]?.match(/maza-([a-z0-9]+)-henriques/)
      if (slugMatch?.[1]) deploymentId = `dpl_${slugMatch[1]}`
    }
  }

  if (!vercelToken) {
    // NOTE FOR IKE: Add VERCEL_TOKEN to Vercel env vars to enable auto-promote.
    // vercel.com/account/tokens → Create token → add as VERCEL_TOKEN in the Marena project.
    return {
      success: false,
      message: 'VERCEL_TOKEN não configurada — deploy não promovido automaticamente',
      action_taken: 'deploy_skipped_no_token',
    }
  }

  if (!deploymentId) {
    return {
      success: false,
      message: 'ID do deployment não encontrado no payload',
      action_taken: 'deploy_skipped_no_id',
    }
  }

  try {
    const promoteRes = await fetch(
      `https://api.vercel.com/v13/deployments/${deploymentId}/promote`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const status = promoteRes.ok ? 'promovido' : `erro ${promoteRes.status}`

    await sendDiscordMessage('orquestrador', {
      title: '🚀 Deploy promovido para produção',
      description: `Deployment aprovado e promovido com sucesso.`,
      color: promoteRes.ok ? DISCORD_COLORS.green : DISCORD_COLORS.red,
      fields: [
        { name: 'Deploy URL', value: deploymentUrl || 'N/A', inline: false },
        { name: 'Status', value: status, inline: true },
        { name: 'Deployment ID', value: deploymentId, inline: true },
      ],
      timestamp: new Date().toISOString(),
    })

    return {
      success: promoteRes.ok,
      message: `Deployment ${status}`,
      action_taken: promoteRes.ok ? 'deploy_promoted' : 'deploy_promote_failed',
    }
  } catch (e) {
    return {
      success: false,
      message: `Erro ao promover deployment: ${e instanceof Error ? e.message : 'desconhecido'}`,
      action_taken: 'deploy_promote_error',
    }
  }
}

// ── Task 4 — learning_machine_weekly ──────────────────────────────────

async function handleLearningMachineApproval(job: {
  id: string
  payload: { week?: number; year?: number; proximos_passos?: Array<{
    prioridade: 'alta' | 'media' | 'baixa'
    acao: string
    agente_responsavel: string
  }> }
  result: { score?: number; headline?: string }
}): Promise<ApprovalResult> {
  const supabase = createServiceClient()
  if (!supabase) {
    return { success: false, message: 'Supabase indisponível', action_taken: 'none' }
  }

  const proximos = (job.payload?.proximos_passos ?? []).filter(
    (p) => p.prioridade === 'alta'
  )

  if (proximos.length === 0) {
    return {
      success: true,
      message: 'Nenhum próximo passo de alta prioridade encontrado',
      action_taken: 'lm_no_high_priority_steps',
    }
  }

  // Get max sprint
  const { data: sprintRows } = await (supabase as any)
    .from('roadmap_items')
    .select('sprint')
    .order('sprint', { ascending: false })
    .limit(1)

  const maxSprint: number = (sprintRows as any)?.[0]?.sprint ?? 0
  const nextSprint = maxSprint + 1

  // Insert roadmap items
  const inserts = proximos.map((p) => ({
    title: p.acao,
    description: `Learning Machine — agente: ${p.agente_responsavel}`,
    sprint: nextSprint,
    status: 'backlog',
    module: 'Learning Machine',
  }))

  const { error } = await (supabase as any)
    .from('roadmap_items')
    .insert(inserts)

  if (error) {
    return { success: false, message: error.message, action_taken: 'lm_roadmap_insert_failed' }
  }

  await sendDiscordMessage('orquestrador', {
    title: '🧠 Próximos passos adicionados ao Roadmap',
    description: `${inserts.length} item(s) de alta prioridade da semana ${job.payload?.week}/${job.payload?.year} foram adicionados.`,
    color: DISCORD_COLORS.purple,
    fields: [
      { name: 'Sprint', value: `Sprint ${nextSprint}`, inline: true },
      { name: 'Itens adicionados', value: `${inserts.length}`, inline: true },
      ...inserts.map((i) => ({ name: '• ' + i.title.slice(0, 50), value: i.description, inline: false })),
    ],
    timestamp: new Date().toISOString(),
  })

  return {
    success: true,
    message: `${inserts.length} item(s) adicionados ao Sprint ${nextSprint}`,
    action_taken: `lm_roadmap_added_sprint_${nextSprint}`,
  }
}

// ── Task 5 — alert_generated ───────────────────────────────────────────

async function handleAlertApproval(job: {
  id: string
  payload: {
    brand_name?: string
    description?: string
    severity?: string
    module?: string
  }
}): Promise<ApprovalResult> {
  const supabase = createServiceClient()
  if (!supabase) {
    return { success: false, message: 'Supabase indisponível', action_taken: 'none' }
  }

  const brandName = job.payload?.brand_name ?? 'Desconhecida'
  const description = job.payload?.description ?? 'Alerta reconhecido'
  const severity = job.payload?.severity ?? 'warning'

  // Map to maza_alerts actual schema — prioridade uses P0/P1/P2/P3
  const prioridade = severity === 'critical' ? 'P0' : severity === 'warning' ? 'P1' : 'P2'

  const { error } = await (supabase as any)
    .from('maza_alerts')
    .insert({
      tipo: 'alerta',
      prioridade,
      mensagem: description,
      entidade: brandName,
      canal: 'orquestrador',
      enviado_para: [],
      enviado_em: new Date().toISOString(),
      lido: true,
      resolvido: true,
    })

  if (error) {
    console.error('[approve-handler] maza_alerts insert error:', error.message)
    // Non-fatal — still acknowledge via Discord
  }

  await sendDiscordMessage('orquestrador', {
    title: `✅ Alerta reconhecido — ${brandName}`,
    description,
    color: DISCORD_COLORS.green,
    fields: [
      { name: 'Marca', value: brandName, inline: true },
      { name: 'Severidade', value: severity, inline: true },
      { name: 'Módulo', value: job.payload?.module ?? 'N/A', inline: true },
    ],
    timestamp: new Date().toISOString(),
  })

  return {
    success: true,
    message: `Alerta de ${brandName} reconhecido`,
    action_taken: 'alert_acknowledged',
  }
}

// ── Task 6 — feedback_received ─────────────────────────────────────────

async function handleFeedbackApproval(job: {
  id: string
  payload: {
    feedback_id?: string
    module?: string
    priority?: string
    description?: string
  }
}): Promise<ApprovalResult> {
  const supabase = createServiceClient()
  if (!supabase) {
    return { success: false, message: 'Supabase indisponível', action_taken: 'none' }
  }

  const description = job.payload?.description ?? 'Feedback recebido'
  const module = job.payload?.module ?? 'Geral'

  // Get max sprint
  const { data: sprintRows } = await (supabase as any)
    .from('roadmap_items')
    .select('sprint')
    .order('sprint', { ascending: false })
    .limit(1)

  const maxSprint: number = (sprintRows as any)?.[0]?.sprint ?? 0
  const nextSprint = maxSprint + 1

  // Insert into roadmap_items
  const { error: roadmapError } = await (supabase as any)
    .from('roadmap_items')
    .insert({
      title: `Feedback: ${description.slice(0, 60)}`,
      description,
      sprint: nextSprint,
      status: 'backlog',
      module,
    })

  if (roadmapError) {
    return { success: false, message: roadmapError.message, action_taken: 'feedback_roadmap_insert_failed' }
  }

  // Update feedback status if feedback_id provided
  if (job.payload?.feedback_id) {
    await (supabase as any)
      .from('feedback')
      .update({ status: 'triaged' })
      .eq('id', job.payload.feedback_id)
  }

  await sendDiscordMessage('orquestrador', {
    title: '💬 Feedback adicionado ao Roadmap',
    description: description.slice(0, 200),
    color: DISCORD_COLORS.amber,
    fields: [
      { name: 'Módulo', value: module, inline: true },
      { name: 'Sprint', value: `Sprint ${nextSprint}`, inline: true },
    ],
    timestamp: new Date().toISOString(),
  })

  return {
    success: true,
    message: `Feedback adicionado ao Sprint ${nextSprint}`,
    action_taken: `feedback_triaged_sprint_${nextSprint}`,
  }
}
