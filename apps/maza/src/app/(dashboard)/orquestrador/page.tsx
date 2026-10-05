import { listOrchestratorRuns } from "@/lib/orquestrador/actions";
import { loadLMReports, generateLearningMachineReport } from "@maza/core/learning-machine";
import { notifyLearningMachineDiscord } from "@/lib/orquestrador/lm-notify";
import { handleApproval } from "@/lib/orquestrador/approve-handler";
import { createServiceClient } from "@maza/db/supabase/server";
import { applyScoreCap, scoreColorClass, type ProposalRisk } from "@maza/core";
import type { LMReport } from "@maza/core/learning-machine";

// Label map — cobre todos os módulos planejados; fallback capitaliza o slug
const MODULE_LABELS: Record<string, string> = {
  pessoas:    "Pessoas",
  operacao:   "Operação",
  financeiro: "Financeiro",
  comercial:  "Comercial",
  compras:    "Compras",
  marca:      "Marca",
};

function moduleLabel(slug: string): string {
  return MODULE_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

type ModuleScore = {
  modulo: string;
  score: number | null;
  score_oficial: number | null;
  cap_razao: string | null;
  insight_text: string | null;
  semana: string | null;
};

type ScoreRow = { modulo: string; score: number | null; semana: string | null };
type InsightRow = { modulo: string; insight_text: string | null };

type ModuleScoresResult =
  | { ok: true; data: ModuleScore[] }
  | { ok: false; error: string };

/**
 * Carrega scores por módulo aplicando a política de teto do kernel.
 * Sempre retorna todos os módulos planejados — sem dados → score_oficial null.
 */
async function loadModuleScores(): Promise<ModuleScoresResult> {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };

  try {
    const [scoresRes, insightsRes, proposalsRes] = await Promise.all([
      (supabase as any)
        .from("maza_intelligence_scores")
        .select("modulo, score, semana, created_at")
        .not("modulo", "is", null)
        .order("created_at", { ascending: false })
        .limit(100),
      (supabase as any)
        .from("maza_insights")
        .select("modulo, insight_text, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      (supabase as any)
        .from("maza_learning_proposals")
        .select("id, modulo, severidade, titulo, status")
        .in("status", ["pending", "open"])
        .not("severidade", "is", null),
    ]);

    if (scoresRes.error) return { ok: false, error: scoresRes.error.message };

    // Agrupa proposals por modulo
    const proposalsByModule = new Map<string, ProposalRisk[]>();
    for (const p of (proposalsRes.data ?? []) as (ProposalRisk & { modulo: string })[]) {
      if (!p.modulo) continue;
      if (!proposalsByModule.has(p.modulo)) proposalsByModule.set(p.modulo, []);
      proposalsByModule.get(p.modulo)!.push(p);
    }

    // Deduplica scores: mais recente por modulo
    const seenScores = new Set<string>();
    const scoreMap = new Map<string, ScoreRow>();
    for (const row of (scoresRes.data ?? []) as ScoreRow[]) {
      if (!row.modulo || seenScores.has(row.modulo)) continue;
      seenScores.add(row.modulo);
      scoreMap.set(row.modulo, row);
    }

    // Deduplica insights: mais recente por modulo
    const seenInsights = new Set<string>();
    const insightMap = new Map<string, string | null>();
    for (const row of (insightsRes.data ?? []) as InsightRow[]) {
      if (!row.modulo || seenInsights.has(row.modulo)) continue;
      seenInsights.add(row.modulo);
      insightMap.set(row.modulo, row.insight_text);
    }

    // Módulos com dados: aplica teto e grava score_oficial
    const results: ModuleScore[] = [];
    const updatePromises: Promise<unknown>[] = [];

    for (const [mod, sr] of scoreMap) {
      const rawScore = sr.score ?? 0;
      const capResult = applyScoreCap(rawScore, proposalsByModule.get(mod) ?? []);

      results.push({
        modulo:        mod,
        score:         sr.score,
        score_oficial: capResult.score_oficial,
        cap_razao:     capResult.cap_razao,
        semana:        sr.semana,
        insight_text:  insightMap.get(mod) ?? null,
      });

      if (sr.semana) {
        updatePromises.push(
          (supabase as any)
            .from("maza_intelligence_scores")
            .update({ score_oficial: capResult.score_oficial, cap_razao: capResult.cap_razao })
            .eq("modulo", mod)
            .eq("semana", sr.semana),
        );
      }
    }

    Promise.all(updatePromises).catch(() => {});

    // Módulos planejados sem dados ainda → card "sem dados"
    for (const mod of Object.keys(MODULE_LABELS)) {
      if (!scoreMap.has(mod)) {
        results.push({ modulo: mod, score: null, score_oficial: null, cap_razao: null, semana: null, insight_text: null });
      }
    }

    // Módulos com score primeiro (desc), sem dados no final
    results.sort((a, b) => {
      if (a.score_oficial == null && b.score_oficial == null) return 0;
      if (a.score_oficial == null) return 1;
      if (b.score_oficial == null) return -1;
      return b.score_oficial - a.score_oficial;
    });

    return { ok: true, data: results };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
import { ApproveJobButton } from "./ApproveJobButton";
import { InsightPanel } from "@/components/intelligence/InsightPanel";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { revalidatePath } from "next/cache";
import { Brain, Clock, Play, RefreshCw, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

// ── Server Actions ────────────────────────────────────────────────────

async function triggerLearningMachine() {
  "use server";
  await generateLearningMachineReport({ notify: notifyLearningMachineDiscord });
  revalidatePath("/orquestrador");
}

async function approveOrquestradorJob(jobId: string) {
  "use server";
  const result = await handleApproval(jobId);
  revalidatePath("/orquestrador");
  return result;
}

// ── Pending jobs loader ────────────────────────────────────────────────

type OrquestradorJob = {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
};

async function loadPendingJobs(): Promise<OrquestradorJob[]> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return [];
    const { data } = await (supabase as any)
      .from("orquestrador_jobs")
      .select("id, type, status, payload, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []) as OrquestradorJob[];
  } catch {
    return [];
  }
}

// ── Page ──────────────────────────────────────────────────────────────

export default async function OrchestratorPage() {
  const [runs, lmReports, pendingJobs, moduleScoresResult] = await Promise.all([
    listOrchestratorRuns(),
    loadLMReports(1),
    loadPendingJobs(),
    loadModuleScores(),
  ]);

  const latestLM = lmReports?.[0] ?? null;
  const ultimoScore: number | null = latestLM?.insights?.score_operacional ?? null;
  const moduleScores = moduleScoresResult.ok ? moduleScoresResult.data : [];
  const moduleScoresError = moduleScoresResult.ok ? null : moduleScoresResult.error;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Orquestrador HOS</h2>
        <div className="flex items-center space-x-2">
          <Link
            href="/orquestrador/insights"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
          >
            Insights
          </Link>
        </div>
      </div>

      {/* Pending Jobs — NO TOPO quando há aprovações pendentes */}
      {pendingJobs.length > 0 && (
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-card-foreground shadow-sm p-6">
          <div className="flex items-center gap-2 pb-4">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-lg font-semibold leading-none tracking-tight">
              Aguardando aprovação
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 ml-1">
              {pendingJobs.length}
            </span>
          </div>
          <div className="w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Resumo</th>
                  <th className="px-4 py-3 font-medium">Criado</th>
                  <th className="px-4 py-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pendingJobs.map((job) => (
                  <tr key={job.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {job.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[240px] truncate">
                      {typeof job.payload?.headline === "string"
                        ? job.payload.headline
                        : typeof job.payload?.description === "string"
                        ? job.payload.description
                        : JSON.stringify(job.payload).slice(0, 80)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true, locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ApproveJobButton
                        jobId={job.id}
                        jobType={job.type}
                        approveAction={approveOrquestradorJob}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Learning Machine Panel */}
      <LearningMachinePanel report={latestLM} triggerAction={triggerLearningMachine} />

      {/* Scores por Módulo */}
      <div className="rounded-md border bg-card text-card-foreground shadow-sm p-6">
        <div className="pb-3 mb-4 border-b">
          <h3 className="text-base font-semibold leading-none tracking-tight">Scores por Módulo</h3>
          <p className="text-xs text-muted-foreground mt-1">Calculados pelos agentes IA dedicados — atualização diária 06h BRT</p>
        </div>

        {moduleScoresError ? (
          <div className="flex items-center gap-2 py-4 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Erro ao carregar scores: {moduleScoresError}</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {moduleScores.map((m) => {
              const displayScore = m.score_oficial;
              const isCapped = m.cap_razao != null;
              const hasData = displayScore != null;
              return (
                <div
                  key={m.modulo}
                  className={`rounded-md p-3 border ${
                    !hasData ? "bg-muted/20 border-dashed border-border/40" :
                    isCapped ? "bg-muted/40 border-red-500/40 dark:border-red-400/30" :
                    "bg-muted/40 border-border/60"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {moduleLabel(m.modulo)}
                    </span>
                    {isCapped && (
                      <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 leading-none">
                        TETO
                      </span>
                    )}
                  </div>
                  {hasData ? (
                    <>
                      <div className={`text-3xl font-bold tabular-nums ${scoreColorClass(displayScore)}`}>
                        {displayScore}
                        <span className="text-sm font-normal text-muted-foreground ml-0.5">/100</span>
                      </div>
                      {m.semana && (
                        <div className="text-xs text-muted-foreground mt-1">
                          semana de {new Date(m.semana + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </div>
                      )}
                      {m.cap_razao && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5 leading-snug border-t border-red-500/20 pt-1.5">
                          {m.cap_razao}
                        </p>
                      )}
                      {!m.cap_razao && m.insight_text && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                          {m.insight_text}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground/60 italic mt-1">Sem dados</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contextual AI Insight Panel */}
      <InsightPanel
        module="orquestrador"
        context={{
          jobs_pendentes: pendingJobs.length,
          ultimo_score_operacional: ultimoScore,
          total_runs: runs.length,
        }}
        title="Insight Operacional"
      />

      <div className="grid gap-4">
        <div className="rounded-md border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex flex-col space-y-1.5 pb-4">
            <h3 className="text-2xl font-semibold leading-none tracking-tight">Execuções Recentes</h3>
            <p className="text-sm text-muted-foreground">
              Acompanhe e aprove as ações sugeridas pelos Agentes de IA.
            </p>
          </div>

          <div className="w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Payload (Origem)</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-muted-foreground">
                      Nenhuma execução encontrada.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{run.job?.name}</div>
                        <div className="text-xs text-muted-foreground">{run.job?.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate">
                        {run.payload?.preview_url ? (
                          <a href={run.payload.preview_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                            {run.payload.preview_url}
                          </a>
                        ) : run.payload?.pr_number ? (
                          <span>PR #{run.payload.pr_number}</span>
                        ) : run.payload?.deployment_url ? (
                          <a href={run.payload.deployment_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                            {run.payload.deployment_url}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {formatDistanceToNow(new Date(run.created_at), { addSuffix: true, locale: ptBR })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/orquestrador/${run.id}`}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                        >
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LearningMachinePanel ──────────────────────────────────────────────

function LearningMachinePanel({
  report,
  triggerAction,
}: {
  report: LMReport | null;
  triggerAction: () => Promise<void>;
}) {
  const score = report?.insights?.score_operacional ?? null;

  return (
    <div className="rounded-md border bg-card text-card-foreground shadow-sm p-6">
      <div className="flex items-start justify-between pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-2xl font-semibold leading-none tracking-tight">
              Learning Machine
            </h3>
            {report && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                Semana {report.week_number}/{report.year}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {report?.insights?.headline ?? "Análise semanal dos 40 agentes IA da Marena."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {score !== null && (
            <div className="text-right">
              <div className={`text-4xl font-bold tabular-nums ${scoreColorClass(score)}`}>{score}</div>
              <div className="text-xs text-muted-foreground">score operacional</div>
            </div>
          )}
          <form action={triggerAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 whitespace-nowrap"
            >
              {report
                ? <><RefreshCw className="h-3.5 w-3.5" /> Atualizar</>
                : <><Play className="h-3.5 w-3.5" /> Gerar análise agora</>}
            </button>
          </form>
        </div>
      </div>

      {!report ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm font-medium text-foreground mb-1">Nenhuma análise gerada ainda</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            O cron roda toda sexta às 08:00 BRT. Clique em &ldquo;Gerar análise agora&rdquo; para criar o primeiro relatório manualmente.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-md bg-muted/50 p-3">
              <div className="text-2xl font-bold tabular-nums">{report.total_runs}</div>
              <div className="text-xs text-muted-foreground">execuções</div>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <div className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
                {report.active_agents}
              </div>
              <div className="text-xs text-muted-foreground">agentes ativos</div>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {report.inactive_agents}
              </div>
              <div className="text-xs text-muted-foreground">agentes dormentes</div>
            </div>
          </div>

          {report.top_agents && report.top_agents.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Top agentes da semana
              </div>
              <div className="flex flex-wrap gap-2">
                {report.top_agents.map((a) => (
                  <span
                    key={a.nome}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                  >
                    {a.nome}
                    <span className="opacity-70">×{a.runs}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {report.insights?.insight_da_semana && (
            <div className="border-l-4 border-yellow-400 pl-3 py-1 mb-4">
              <p className="text-sm text-foreground/80 italic leading-relaxed">
                {report.insights.insight_da_semana}
              </p>
            </div>
          )}

          {report.insights?.proximos_passos && report.insights.proximos_passos.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Próximos passos
              </div>
              <div className="space-y-1">
                {report.insights.proximos_passos.slice(0, 3).map((step, i) => {
                  const prioColor =
                    step.prioridade === "alta" ? "text-red-600 dark:text-red-400" :
                    step.prioridade === "media" ? "text-yellow-600 dark:text-yellow-400" :
                    "text-muted-foreground";
                  return (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className={`text-xs font-bold uppercase mt-0.5 shrink-0 w-10 ${prioColor}`}>
                        {step.prioridade}
                      </span>
                      <span className="text-foreground/80">{step.acao}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Gerado em {new Date(report.generated_at).toLocaleString("pt-BR")} · Cron toda sexta 08:00 BRT
          </div>
        </>
      )}
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    awaiting_approval: "bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300",
    approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };

  const labels: Record<string, string> = {
    pending: "Pendente",
    running: "Executando",
    awaiting_approval: "Aguardando Aprovação",
    approved: "Aprovado",
    rejected: "Rejeitado",
    failed: "Falhou",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[status] || colors.pending}`}>
      {labels[status] || status}
    </span>
  );
}
