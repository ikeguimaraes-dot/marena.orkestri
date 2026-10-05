import { createServiceClient } from "@maza/db/supabase/server";
import { applyScoreCap, scoreColorClass, type ProposalRisk } from "@maza/core";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const dynamic = "force-dynamic";

type PessoasScore = {
  id: string;
  modulo: string;
  score: number | null;
  score_oficial: number | null;
  cap_razao: string | null;
  breakdown: Record<string, number | null> | null;
  semana: string | null;
  created_at: string;
};

type PessoasInsight = {
  insight_text: string;
  semana: string;
  gerado_por: string;
  created_at: string;
};

async function getLatestPessoasScore(): Promise<PessoasScore | null> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return null;

    const [scoreRes, proposalsRes] = await Promise.all([
      (supabase as any)
        .from("maza_intelligence_scores")
        .select("id, modulo, score, breakdown, semana, created_at")
        .eq("modulo", "pessoas")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from("maza_learning_proposals")
        .select("id, severidade, titulo, status")
        .eq("modulo", "pessoas")
        .in("status", ["pending", "open"])
        .not("severidade", "is", null),
    ]);

    if (!scoreRes.data) return null;

    const rawScore: number = scoreRes.data.score ?? 0;
    const proposals: ProposalRisk[] = proposalsRes.data ?? [];
    const capResult = applyScoreCap(rawScore, proposals);

    return {
      ...(scoreRes.data as Omit<PessoasScore, "score_oficial" | "cap_razao">),
      score_oficial: capResult.score_oficial,
      cap_razao: capResult.cap_razao,
    };
  } catch {
    return null;
  }
}

async function getLatestPessoasInsight(): Promise<PessoasInsight | null> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return null;
    const { data } = await (supabase as any)
      .from("maza_insights")
      .select("insight_text, semana, gerado_por, created_at")
      .eq("modulo", "pessoas")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as PessoasInsight) ?? null;
  } catch {
    return null;
  }
}

async function getHistorico(): Promise<PessoasScore[]> {
  try {
    const supabase = createServiceClient();
    if (!supabase) return [];
    const { data } = await (supabase as any)
      .from("maza_intelligence_scores")
      .select("id, modulo, score, breakdown, semana, created_at")
      .eq("modulo", "pessoas")
      .order("created_at", { ascending: false })
      .limit(8);
    return (data ?? []) as PessoasScore[];
  } catch {
    return [];
  }
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  return <span className={`font-bold tabular-nums ${scoreColorClass(score)}`}>{score}</span>;
}

const BREAKDOWN_LABELS: Record<string, string> = {
  headcount: "Headcount",
  turnover: "Turnover",
  folha: "Folha",
  movimentacao: "Movimentação",
};

export default async function PessoasAgentesPage() {
  const [latestScore, latestInsight, historico] = await Promise.all([
    getLatestPessoasScore(),
    getLatestPessoasInsight(),
    getHistorico(),
  ]);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Agentes — Pessoas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Score calculado pelos agentes IA · atualização diária 06h BRT
          </p>
        </div>
      </div>

      {/* PessoasScoreCard */}
      <div className="rounded-md border bg-card text-card-foreground shadow-sm p-6">
        <div className="flex items-start justify-between pb-4 border-b mb-4">
          <div>
            <h3 className="text-base font-semibold leading-none tracking-tight">Score Pessoas</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Módulo: <code className="bg-muted px-1 rounded text-xs">pessoas</code>
              {latestScore?.semana && (
                <> · semana de {new Date(latestScore.semana + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</>
              )}
            </p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold tabular-nums">
              <ScoreBadge score={latestScore?.score_oficial ?? null} />
            </div>
            <div className="text-xs text-muted-foreground mt-1">/100</div>
            {latestScore?.cap_razao && (
              <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 mt-1">
                TETO
              </div>
            )}
          </div>
        </div>

        {/* Breakdown */}
        {latestScore?.breakdown ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {Object.entries(latestScore.breakdown).map(([key, val]) => (
              <div key={key} className="rounded-md bg-muted/40 p-3 border border-border/60">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  {BREAKDOWN_LABELS[key] ?? key}
                </div>
                <div className="text-2xl font-bold">
                  <ScoreBadge score={val} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">Nenhum score calculado ainda — agentes ainda não rodaram.</p>
        )}

        {/* Insight */}
        {latestInsight && (
          <div className="border-l-4 border-yellow-400 pl-3 py-1">
            <p className="text-sm text-foreground/80 italic leading-relaxed">{latestInsight.insight_text}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Gerado por <strong>{latestInsight.gerado_por}</strong> ·{" "}
              {formatDistanceToNow(new Date(latestInsight.created_at), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        )}
      </div>

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="rounded-md border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-base font-semibold leading-none tracking-tight mb-4">Histórico de Scores</h3>
          <div className="w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Semana</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Headcount</th>
                  <th className="px-4 py-3 font-medium">Turnover</th>
                  <th className="px-4 py-3 font-medium">Folha</th>
                  <th className="px-4 py-3 font-medium">Movimentação</th>
                  <th className="px-4 py-3 font-medium">Calculado</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.semana
                        ? new Date(row.semana + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-bold"><ScoreBadge score={row.score_oficial ?? row.score} /></td>
                    <td className="px-4 py-3"><ScoreBadge score={row.breakdown?.headcount ?? null} /></td>
                    <td className="px-4 py-3"><ScoreBadge score={row.breakdown?.turnover ?? null} /></td>
                    <td className="px-4 py-3"><ScoreBadge score={row.breakdown?.folha ?? null} /></td>
                    <td className="px-4 py-3"><ScoreBadge score={row.breakdown?.movimentacao ?? null} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: ptBR })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
