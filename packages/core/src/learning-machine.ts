// Learning Machine — análise semanal de atividade dos agentes IA da Marena.
// Roda toda sexta via Vercel Cron (0 11 * * 5 = 08:00 BRT).
// Requer ANTHROPIC_API_KEY configurada no ambiente.
//
// Kernel @maza/core: implementação ÚNICA, consumida pelo shell (apps/maza)
// e pelo app inteligencia (apps/inteligencia). Notificação pós-relatório é
// injetada pelo caller via `opts.notify` — o core não conhece Discord.

import { createSupabaseServerClient } from "@maza/db/supabase/server";

// ── Catálogo dos 40 agentes por categoria ─────────────────────────────

export const AGENT_REGISTRY: Record<string, string[]> = {
  "Código & Plataformas": [
    "maza-dev",
    "hos-app-dev",
    "mise-dev",
    "mcp-builder",
    "migration-writer",
    "railway-ops",
    "feature-builder",
  ],
  "Qualidade & Testes": [
    "ux-reviewer",
    "webapp-tester",
    "api-validator",
    "a11y-checker",
  ],
  "Financeiro & Operação": [
    "financial-reviewer",
    "cashflow-forecaster",
    "menu-engineer",
  ],
  "Conteúdo & Marca": ["brand-checker", "social-planner", "deck-builder"],
  "RH & Pessoas": ["people-ops", "ops-checklist", "learning-machine"],
  "Gestão & Inteligência": [
    "general-purpose",
    "superpowers:code-reviewer",
    "Explore",
  ],
  "Experiência Digital & SEO": [
    "seo-google",
    "seo-performance",
    "seo-technical",
    "seo-local",
    "seo-sxo",
    "seo-schema",
    "seo-content",
    "seo-cluster",
    "seo-backlinks",
    "seo-ecommerce",
    "seo-geo",
    "seo-drift",
    "seo-maps",
    "seo-image-gen",
    "seo-sitemap",
    "seo-dataforseo",
    "seo-visual",
  ],
};

export const ALL_AGENTS = Object.values(AGENT_REGISTRY).flat();

// ── Tipos ─────────────────────────────────────────────────────────────

export type LMReportInsight = {
  headline: string;
  score_operacional: number;
  agentes_destaque: { nome: string; categoria: string; motivo: string }[];
  agentes_dormentes: {
    nome: string;
    categoria: string;
    dias_sem_uso: number;
    recomendacao: string;
  }[];
  gaps_identificados: {
    area: string;
    descricao: string;
    agente_sugerido: string;
  }[];
  proximos_passos: {
    prioridade: "alta" | "media" | "baixa";
    acao: string;
    agente_responsavel: string;
  }[];
  insight_da_semana: string;
};

export type AgentRunRow = {
  agent_name: string;
  category: string;
  status: string;
  week_number: number;
  year: number;
  created_at: string;
};

/** Resumo entregue ao notifier injetado após o relatório ser salvo. */
export type LMNotifyPayload = {
  week: number;
  year: number;
  insights: LMReportInsight | null;
  activeAgents: number;
  totalAgents: number;
  dormantCount: number;
};

export type LMReport = {
  id: string;
  week_number: number;
  year: number;
  total_runs: number;
  active_agents: number;
  inactive_agents: number;
  top_agents: { nome: string; categoria: string; runs: number }[];
  dormant_agents: { nome: string; categoria: string; dias_sem_uso: number; recomendacao: string }[];
  missing_agents: string[];
  insights: LMReportInsight | null;
  raw_analysis: string | null;
  generated_at: string;
};

// ── ISO week helpers ──────────────────────────────────────────────────

function currentIsoWeek(): { week: number; year: number } {
  const now = new Date();
  const thursday = new Date(now);
  thursday.setUTCDate(now.getUTCDate() + 3 - ((now.getUTCDay() + 6) % 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return { week, year: thursday.getUTCFullYear() };
}

// ── Main function ─────────────────────────────────────────────────────

export async function generateLearningMachineReport(
  opts: { notify?: (payload: LMNotifyPayload) => Promise<void> } = {},
): Promise<LMReport | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { week, year } = currentIsoWeek();

  // 1) Fetch agent_runs for current week
  const { data: runsData, error: runsError } = await (supabase as any)
    .from("agent_runs")
    .select("agent_name, category, status, created_at")
    .eq("week_number", week)
    .eq("year", year);

  if (runsError) {
    console.error("[LM] agent_runs fetch error:", runsError.message);
    return null;
  }

  type RunRow = { agent_name: string; category: string; status: string; created_at: string };
  const runs = (runsData ?? []) as RunRow[];

  // 2) Build summary stats
  const runsByAgent = new Map<string, number>();
  for (const r of runs) {
    if (r.status === "completed") {
      runsByAgent.set(r.agent_name, (runsByAgent.get(r.agent_name) ?? 0) + 1);
    }
  }

  const activeAgents = new Set(runsByAgent.keys());
  const inactiveAgents = ALL_AGENTS.filter((a) => !activeAgents.has(a));
  const topAgents = Array.from(runsByAgent.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nome, agentRuns]) => {
      const categoria =
        Object.entries(AGENT_REGISTRY).find(([, agents]) =>
          agents.includes(nome),
        )?.[0] ?? "Desconhecida";
      return { nome, categoria, runs: agentRuns };
    });

  const agentRunsSummary = topAgents
    .map((a) => `  - ${a.nome} (${a.categoria}): ${a.runs} execuções`)
    .join("\n");

  const inactiveSample = inactiveAgents.slice(0, 10).join(", ");

  const agentListByCategory = Object.entries(AGENT_REGISTRY)
    .map(([cat, agents]) => `  ${cat} (${agents.length}): ${agents.join(", ")}`)
    .join("\n");

  // 3) Call Claude Haiku for analysis
  let insights: LMReportInsight | null = null;
  let rawAnalysis: string | null = null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const dormantList = inactiveAgents
        .slice(0, 8)
        .map((a) => {
          const cat =
            Object.entries(AGENT_REGISTRY).find(([, agents]) =>
              agents.includes(a),
            )?.[0] ?? "Desconhecida";
          return `${a} (${cat})`;
        })
        .join(", ");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `Você é o Learning Machine da Marena — plataforma de operações hospitaleiras. Analise a atividade semanal dos agentes IA especializados.

Semana ${week}/${year} — Relatório Learning Machine

AGENTES REGISTRADOS (40 total, 7 categorias):
${agentListByCategory}

ATIVIDADE DA SEMANA:
- Total de execuções: ${runs.length}
- Agentes ativos: ${activeAgents.size}/${ALL_AGENTS.length}
- Top agentes:
${agentRunsSummary || "  Nenhum agente ativo esta semana"}
- Agentes sem uso (amostra): ${dormantList || "nenhum"}

Analise e responda APENAS com JSON válido nesta estrutura exata (sem markdown, sem explicação fora do JSON):
{
  "headline": "frase de 10 palavras resumindo a semana de trabalho dos agentes",
  "score_operacional": 0,
  "agentes_destaque": [
    {"nome": "", "categoria": "", "motivo": ""}
  ],
  "agentes_dormentes": [
    {"nome": "", "categoria": "", "dias_sem_uso": 7, "recomendacao": ""}
  ],
  "gaps_identificados": [
    {"area": "", "descricao": "", "agente_sugerido": ""}
  ],
  "proximos_passos": [
    {"prioridade": "alta", "acao": "", "agente_responsavel": ""}
  ],
  "insight_da_semana": "parágrafo de 3-4 frases em português"
}`,
            },
          ],
        }),
      });

      if (response.ok) {
        const aiResponse = await response.json();
        rawAnalysis = aiResponse.content?.[0]?.text ?? null;

        if (rawAnalysis) {
          // Extract JSON robustly: find first { and last } regardless of markdown fences
          const jsonStart = rawAnalysis.indexOf("{");
          const jsonEnd = rawAnalysis.lastIndexOf("}");
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            insights = JSON.parse(rawAnalysis.slice(jsonStart, jsonEnd + 1)) as LMReportInsight;
          }
        }
      }
    } catch (e) {
      console.error("[LM] Anthropic error:", e);
      // Continue without AI insights — still save the activity stats
    }
  }

  // 4) Build dormant agents list for DB
  const dormantAgents = inactiveAgents.slice(0, 10).map((nome) => {
    const categoria =
      Object.entries(AGENT_REGISTRY).find(([, agents]) =>
        agents.includes(nome),
      )?.[0] ?? "Desconhecida";
    return {
      nome,
      categoria,
      dias_sem_uso: 7,
      recomendacao:
        insights?.agentes_dormentes?.find((d) => d.nome === nome)
          ?.recomendacao ?? "Verificar se há demanda para este agente",
    };
  });

  // 5) Upsert report into learning_machine_reports
  const reportPayload = {
    week_number: week,
    year,
    total_runs: runs.length,
    active_agents: activeAgents.size,
    inactive_agents: ALL_AGENTS.length - activeAgents.size,
    top_agents: topAgents,
    dormant_agents: dormantAgents,
    missing_agents: inactiveSample.split(", ").filter(Boolean),
    insights,
    raw_analysis: rawAnalysis,
    generated_at: new Date().toISOString(),
  };

  const { data: saved, error: saveError } = await (supabase as any)
    .from("learning_machine_reports")
    .upsert(reportPayload, { onConflict: "week_number,year" })
    .select("id")
    .single();

  if (saveError) {
    console.error("[LM] save report error:", saveError.message);
    return null;
  }

  // 6) Insert orquestrador job entry
  await (supabase as any)
    .from("orquestrador_jobs")
    .insert({
      type: "learning_machine_weekly",
      status: "success",
      payload: { week, year, triggered_by: "cron" },
      result: {
        total_runs: runs.length,
        active_agents: activeAgents.size,
        score: insights?.score_operacional ?? null,
        headline: insights?.headline ?? null,
      },
    })
    .then(() => {/* silencioso */});

  // 7) Notificação injetada pelo caller (falha não derruba o relatório)
  if (opts.notify) {
    try {
      await opts.notify({
        week,
        year,
        insights,
        activeAgents: activeAgents.size,
        totalAgents: ALL_AGENTS.length,
        dormantCount: ALL_AGENTS.length - activeAgents.size,
      });
    } catch (e) {
      console.error("[LM] notify error:", e);
    }
  }

  return {
    id: (saved as { id: string }).id,
    ...reportPayload,
    insights,
    raw_analysis: rawAnalysis,
  };
}

// ── Loader: fetches the last N reports ───────────────────────────────

export async function loadLMReports(limit = 4): Promise<LMReport[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  try {
    const { data, error } = await (supabase as any)
      .from("learning_machine_reports")
      .select(
        "id, week_number, year, total_runs, active_agents, inactive_agents, top_agents, dormant_agents, missing_agents, insights, raw_analysis, generated_at",
      )
      .order("year", { ascending: false })
      .order("week_number", { ascending: false })
      .limit(limit);

    if (error) return null;
    return (data ?? []) as LMReport[];
  } catch {
    return null;
  }
}
