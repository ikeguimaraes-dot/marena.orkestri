"use server"
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createServiceClient } from "@maza/db/supabase/server";
import { requireUser } from "@maza/auth/server";
import type { ActionResult } from "@/lib/result";

// ── Types ──────────────────────────────────────────────────────────

export type HosJob = {
  id: string;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type HosRunStatus = "pending" | "running" | "awaiting_approval" | "approved" | "rejected" | "failed";

export type HosRun = {
  id: string;
  job_id: string;
  status: HosRunStatus;
  payload: any;
  logs: any[];
  result_data: any;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type HosRunWithJob = HosRun & {
  job: HosJob | null;
  hos_approvals?: HosApproval[];
};

export type HosApproval = {
  id: string;
  run_id: string;
  user_id: string;
  decision: "approve" | "reject";
  feedback: string | null;
  created_at: string;
};

// ── Actions ────────────────────────────────────────────────────────

export async function listOrchestratorRuns(): Promise<HosRunWithJob[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("hos_runs")
      .select("*, job:hos_jobs(*)")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[listOrchestratorRuns] error:", error.message);
      return [];
    }
    return (data ?? []) as HosRunWithJob[];
  } catch (e) {
    console.error("[listOrchestratorRuns] exceção:", e);
    return [];
  }
}

export async function getRunDetails(id: string): Promise<HosRunWithJob | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("hos_runs")
      .select("*, job:hos_jobs(*), hos_approvals(*)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[getRunDetails] error:", error.message);
      return null;
    }
    return (data ?? null) as HosRunWithJob | null;
  } catch (e) {
    console.error("[getRunDetails] exceção:", e);
    return null;
  }
}

export async function submitRunDecision(
  runId: string,
  decision: "approve" | "reject",
  feedback?: string
): Promise<ActionResult<HosApproval>> {
  try {
    const user = await requireUser();
    if (!user) return { ok: false, error: "Não autorizado" };

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    // 1. Idempotência: verificar que o run ainda está awaiting_approval
    const { data: run, error: runFetchErr } = await supabase
      .from("hos_runs")
      .select("status")
      .eq("id", runId)
      .single();

    if (runFetchErr || !run) {
      return { ok: false, error: "Run não encontrado" };
    }

    if ((run as any).status !== "awaiting_approval") {
      return { ok: false, error: `Run já foi processado (status atual: ${(run as any).status})` };
    }

    // 2. Grava no histórico de aprovações
    const { data: approvalData, error: approvalErr } = await supabase
      .from("hos_approvals")
      .insert({
        run_id: runId,
        user_id: user.id,
        decision,
        feedback: feedback ?? null,
      } as never)
      .select()
      .single();

    if (approvalErr || !approvalData) {
      return { ok: false, error: approvalErr?.message ?? "Falha ao gravar decisão" };
    }

    // 3. Atualiza o status do run — usa .select().single() para detectar bloqueio silencioso de RLS
    const newStatus: HosRunStatus = decision === "approve" ? "approved" : "rejected";
    const { data: updatedRun, error: runErr } = await supabase
      .from("hos_runs")
      .update({ status: newStatus } as never)
      .eq("id", runId)
      .select("id, status")
      .single();

    if (runErr) {
      return { ok: false, error: `Falha ao atualizar status do run: ${runErr.message}` };
    }

    if (!updatedRun) {
      return { ok: false, error: "Permissão negada ao atualizar status do run (verifique policy de UPDATE em hos_runs)" };
    }

    revalidatePath("/orquestrador");
    revalidatePath(`/orquestrador/${runId}`);

    return { ok: true, data: approvalData as HosApproval };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

// ── Discord Decision ───────────────────────────────────────────────

export async function submitRunDecisionFromDiscord(
  runId: string,
  decision: "approve" | "reject",
  discordUser: string
): Promise<ActionResult<void>> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data: run } = await (supabase as any)
      .from("hos_runs")
      .select("status, logs")
      .eq("id", runId)
      .single();

    if (!run) return { ok: false, error: "Run não encontrado" };
    if ((run as any).status !== "awaiting_approval") {
      return { ok: false, error: `Run não está aguardando aprovação (status atual: ${(run as any).status})` };
    }

    const newStatus: HosRunStatus = decision === "approve" ? "approved" : "rejected";
    const logs = [
      ...(((run as any).logs ?? []) as any[]),
      {
        ts: new Date().toISOString(),
        msg: `Decisão via Discord por @${discordUser}: ${newStatus}`,
      },
    ];

    const { error } = await (supabase as any)
      .from("hos_runs")
      .update({ status: newStatus, logs })
      .eq("id", runId);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/orquestrador");
    revalidatePath(`/orquestrador/${runId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

// ── Auto-Approval ──────────────────────────────────────────────────

export async function autoApproveRun(runId: string): Promise<void> {
  const supabase = createServiceClient()
  if (!supabase) return

  await (supabase as any).from('hos_approvals').insert({
    run_id: runId,
    user_id: '00000000-0000-0000-0000-000000000001',
    decision: 'approve',
    feedback: 'Auto-aprovado pelo sistema — job de baixo risco',
  })

  await (supabase as any)
    .from('hos_runs')
    .update({ status: 'approved' })
    .eq('id', runId)
}

// ── Run Helpers (usados por agentes server-side) ───────────────────

export async function createRun(
  jobSlug: string,
  payload: Record<string, unknown>
): Promise<{ id: string }> {
  const supabase = createServiceClient()
  if (!supabase) throw new Error('Supabase indisponível')

  const { data: job } = await (supabase as any)
    .from('hos_jobs')
    .select('id')
    .eq('slug', jobSlug)
    .eq('is_active', true)
    .single()

  if (!job) throw new Error(`Job não encontrado: ${jobSlug}`)

  const { data: run, error } = await (supabase as any)
    .from('hos_runs')
    .insert({
      job_id: job.id,
      status: 'running',
      triggered_by: 'webhook',
      payload,
      logs: [{ ts: new Date().toISOString(), msg: `Run criado para job: ${jobSlug}` }],
    })
    .select('id')
    .single()

  if (error || !run) throw new Error(error?.message ?? 'Falha ao criar run')
  return run as { id: string }
}

export async function updateRunLogs(
  runId: string,
  resultData: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient()
  if (!supabase) return

  await (supabase as any)
    .from('hos_runs')
    .update({ result_data: resultData })
    .eq('id', runId)
}

export async function markRunFailed(runId: string, reason: string): Promise<void> {
  const supabase = createServiceClient()
  if (!supabase) return

  await (supabase as any)
    .from('hos_runs')
    .update({
      status: 'failed',
      result_data: { error: reason, failed_at: new Date().toISOString() },
    })
    .eq('id', runId)
}

// ── Insight Types ──────────────────────────────────────────────────

export type HosInsight = {
  id: string;
  period_start: string;
  period_end: string;
  report_md: string;
  metrics: Record<string, unknown>;
  created_at: string;
};

// ── Insight Actions ────────────────────────────────────────────────

export async function generateWeeklyInsight(): Promise<ActionResult<HosInsight>> {
  try {
    const user = await requireUser();
    if (!user) return { ok: false, error: "Não autorizado" };

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: runs } = await supabase
      .from("hos_runs")
      .select("*, job:hos_jobs(name, slug)")
      .gte("created_at", periodStart.toISOString())
      .order("created_at", { ascending: true });

    const { data: approvals } = await supabase
      .from("hos_approvals")
      .select("run_id, decision, created_at")
      .gte("created_at", periodStart.toISOString());

    const runList = (runs ?? []) as any[];
    const approvalList = (approvals ?? []) as any[];

    const approvalByRun = Object.fromEntries(approvalList.map((a) => [a.run_id, a]));

    const totalRuns = runList.length;
    const approved = runList.filter((r) => r.status === "approved").length;
    const rejected = runList.filter((r) => r.status === "rejected").length;
    const pending = runList.filter((r) =>
      ["pending", "running", "awaiting_approval"].includes(r.status)
    ).length;

    const approvalTimes: number[] = [];
    for (const run of runList) {
      const approval = approvalByRun[run.id];
      if (approval) {
        const diff =
          new Date(approval.created_at).getTime() - new Date(run.created_at).getTime();
        approvalTimes.push(diff / 1000 / 60); // em minutos
      }
    }
    const avgApprovalMinutes =
      approvalTimes.length > 0
        ? Math.round(approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length)
        : null;

    const runsByJob: Record<string, number> = {};
    for (const run of runList) {
      const name = (run.job as any)?.name ?? run.job_id;
      runsByJob[name] = (runsByJob[name] ?? 0) + 1;
    }

    const runsByDay: Record<string, number> = {};
    for (const run of runList) {
      const day = run.created_at.slice(0, 10);
      runsByDay[day] = (runsByDay[day] ?? 0) + 1;
    }

    const metrics = {
      period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
      totalRuns,
      approved,
      rejected,
      pending,
      avgApprovalMinutes,
      runsByJob,
      runsByDay,
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY não configurada" };

    const prompt = `Você é um assistente de operações de tecnologia. Analise as métricas abaixo do Orquestrador HOS (Human-in-the-loop Orchestration System) referentes aos últimos 7 dias e produza um relatório executivo em Markdown.

## Métricas do período

\`\`\`json
${JSON.stringify(metrics, null, 2)}
\`\`\`

## Formato esperado

Produza exatamente as 4 seções abaixo, em português, usando Markdown:

# Insights Semanais — Orquestrador HOS

## Highlights
(principais conquistas e números positivos)

## Problemas Detectados
(gargalos, atrasos, falhas ou padrões preocupantes)

## Sugestões de Melhoria
(ações concretas baseadas nos dados)

## Próximos Passos
(prioridades para a próxima semana)`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { ok: false, error: `Erro na Claude API: ${err}` };
    }

    const aiResponse = await response.json();
    const report_md: string =
      aiResponse.content?.[0]?.text ?? "Relatório não disponível.";

    const { data: insight, error: insightErr } = await supabase
      .from("hos_insights")
      .insert({
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        report_md,
        metrics,
      } as never)
      .select()
      .single();

    if (insightErr || !insight) {
      return { ok: false, error: insightErr?.message ?? "Falha ao salvar insight" };
    }

    revalidatePath("/orquestrador/insights");
    return { ok: true, data: insight as HosInsight };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function listInsights(): Promise<HosInsight[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("hos_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[listInsights] error:", error.message);
      return [];
    }
    return (data ?? []) as HosInsight[];
  } catch (e) {
    console.error("[listInsights] exceção:", e);
    return [];
  }
}

export async function mockCreateRun(jobSlug: string): Promise<ActionResult<HosRun>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data: job, error: jobErr } = await supabase
      .from("hos_jobs")
      .select("*")
      .eq("slug", jobSlug)
      .maybeSingle();

    if (jobErr || !job) {
      return { ok: false, error: "Job não encontrado" };
    }

    const { data: runData, error: runErr } = await supabase
      .from("hos_runs")
      .insert({
        job_id: (job as any).id,
        status: "awaiting_approval",
        payload: {
          preview_url: "http://localhost:3000",
          pr_number: 42,
          commit_sha: "abcd1234efgh5678"
        },
        logs: [
          { time: new Date().toISOString(), message: "Iniciando Agent de QA..." },
          { time: new Date().toISOString(), message: "Acessando URL de preview." },
          { time: new Date().toISOString(), message: "Rodando testes visuais na Home e Dashboard." },
          { time: new Date().toISOString(), message: "Nenhuma regressão visual detectada." },
          { time: new Date().toISOString(), message: "Aguardando aprovação humana." }
        ],
        result_data: {
          screenshots: [
            "https://via.placeholder.com/800x600.png?text=Home+Screenshot",
            "https://via.placeholder.com/800x600.png?text=Dashboard+Screenshot"
          ]
        }
      } as never)
      .select()
      .single();

    if (runErr || !runData) {
      return { ok: false, error: runErr?.message ?? "Falha ao criar run" };
    }

    revalidatePath("/orquestrador");
    return { ok: true, data: runData as HosRun };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
