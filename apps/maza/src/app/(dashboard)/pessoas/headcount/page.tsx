import { createSupabaseServerClient } from "@maza/db/supabase/server";
import { InsightPanel } from "@/components/intelligence/InsightPanel";
import { applyScoreCap, scoreColorClass, type ProposalRisk } from "@maza/core";

type PessoasInsight = {
  id: string;
  insight_text: string;
  semana: string;
  dados_referencia: { score?: number; breakdown?: Record<string, number | null> } | null;
  gerado_por: string;
  created_at: string;
};

type OfficialScore = {
  score_oficial: number;
  cap_razao: string | null;
  score_raw: number;
};

/**
 * Calcula o score oficial de Pessoas aplicando a política de teto do kernel.
 * Lê o score bruto de maza_intelligence_scores e os riscos pendentes de maza_learning_proposals.
 * Grava score_oficial + cap_razao de volta no banco para consistência com o painel central.
 */
async function getOfficialPessoasScore(): Promise<OfficialScore | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const [scoreRes, proposalsRes] = await Promise.all([
      (supabase as any)
        .from("maza_intelligence_scores")
        .select("score, semana")
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

    if (scoreRes.data.semana) {
      (supabase as any)
        .from("maza_intelligence_scores")
        .update({ score_oficial: capResult.score_oficial, cap_razao: capResult.cap_razao })
        .eq("modulo", "pessoas")
        .eq("semana", scoreRes.data.semana)
        .then(() => {});
    }

    return { score_oficial: capResult.score_oficial, cap_razao: capResult.cap_razao, score_raw: rawScore };
  } catch {
    return null;
  }
}

async function getLatestPessoasInsight(): Promise<PessoasInsight | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await (supabase as any)
      .from("maza_insights")
      .select("id, insight_text, semana, dados_referencia, gerado_por, created_at")
      .eq("modulo", "pessoas")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as PessoasInsight) ?? null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

type HeadcountRow = {
  brand_id?: string;
  brand_name?: string;
  headcount_ativo?: number;
  folha_bruta?: number;
  admissoes_mes?: number;
  demissoes_mes?: number;
};

async function getHeadcount(): Promise<HeadcountRow[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data } = await (supabase as any)
      .from("v_headcount_por_marca")
      .select("brand_id, brand_name, headcount_ativo, folha_bruta, admissoes_mes, demissoes_mes")
      .order("headcount_ativo", { ascending: false });
    return (data ?? []) as HeadcountRow[];
  } catch {
    return [];
  }
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default async function HeadcountPage() {
  const [rows, agentInsight, officialScore] = await Promise.all([
    getHeadcount(),
    getLatestPessoasInsight(),
    getOfficialPessoasScore(),
  ]);

  const totalAtivo = rows.reduce((s, r) => s + (r.headcount_ativo ?? 0), 0);
  const totalFolha = rows.reduce((s, r) => s + (r.folha_bruta ?? 0), 0);
  const totalAdmissoes = rows.reduce((s, r) => s + (r.admissoes_mes ?? 0), 0);
  const totalDemissoes = rows.reduce((s, r) => s + (r.demissoes_mes ?? 0), 0);
  const turnover = totalAtivo > 0 ? ((totalDemissoes / totalAtivo) * 100).toFixed(1) : null;

  return (
    <div className="max-w-[1100px] mx-auto flex-1 space-y-7 p-8 pt-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Pessoas</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Headcount e movimentação de colaboradores CLT
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Headcount ativo" value={String(totalAtivo)} />
        <KpiCard label="Folha bruta (mês)" value={BRL.format(totalFolha)} />
        <KpiCard label="Admissões (mês)" value={String(totalAdmissoes)} ok={totalAdmissoes > 0} />
        <KpiCard
          label="Demissões (mês)"
          value={`${totalDemissoes}${turnover ? ` (${turnover}%)` : ""}`}
          alert={Number(turnover) > 5}
        />
      </div>

      {rows.length > 0 ? (
        <div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left" style={{ minWidth: 560 }}>
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                <tr>
                  {["Marca", "Headcount Ativo", "Folha Bruta", "Admissões", "Demissões"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 font-semibold tracking-wide ${h === "Marca" ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.brand_id ?? i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {r.brand_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {r.headcount_ativo ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {BRL.format(r.folha_bruta ?? 0)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${(r.admissoes_mes ?? 0) > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                      {r.admissoes_mes ?? 0}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${(r.demissoes_mes ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                      {r.demissoes_mes ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-sm text-muted-foreground">
          Sem dados de headcount disponíveis. Verifique a integração com o módulo de RH.
        </div>
      )}

      {agentInsight ? (
        <AgentInsightBanner insight={agentInsight} officialScore={officialScore} />
      ) : (
        <InsightPanel
          module="pessoas"
          context={{
            headcount_total: totalAtivo,
            folha_bruta_total: totalFolha,
            admissoes_mes: totalAdmissoes,
            demissoes_mes: totalDemissoes,
            turnover_pct: turnover != null ? Number(turnover) : null,
            por_marca: rows.map((r) => ({
              marca: r.brand_name,
              headcount: r.headcount_ativo,
              admissoes: r.admissoes_mes,
              demissoes: r.demissoes_mes,
            })),
          }}
          title="Insight de Pessoas"
        />
      )}
    </div>
  );
}

function AgentInsightBanner({
  insight,
  officialScore,
}: {
  insight: PessoasInsight;
  officialScore: OfficialScore | null;
}) {
  const displayScore = officialScore?.score_oficial ?? insight.dados_referencia?.score ?? null;
  const capRazao = officialScore?.cap_razao ?? null;
  const isCapped = capRazao != null;

  const semanaFormatted = insight.semana
    ? new Date(insight.semana + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : null;

  return (
    <div className={`rounded-md border bg-card text-card-foreground shadow-sm p-5 border-l-4 ${isCapped ? "border-l-red-500 dark:border-l-red-400" : "border-l-yellow-500 dark:border-l-yellow-400"}`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
            Insight de Pessoas
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 font-bold">
            Agente IA
          </span>
          {isCapped && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-bold">
              TETO APLICADO
            </span>
          )}
          {semanaFormatted && (
            <span className="text-[10px] text-muted-foreground">semana de {semanaFormatted}</span>
          )}
        </div>
        {displayScore != null && (
          <div className="text-right shrink-0">
            <span className={`text-2xl font-bold tabular-nums ${scoreColorClass(displayScore)}`}>
              {displayScore}
            </span>
            <span className="text-xs text-muted-foreground ml-1">/100</span>
          </div>
        )}
      </div>

      {capRazao && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 mb-3 leading-relaxed">
          {capRazao}
        </div>
      )}

      <p className="text-sm text-muted-foreground leading-relaxed">{insight.insight_text}</p>
    </div>
  );
}

function KpiCard({ label, value, ok, alert }: { label: string; value: string; ok?: boolean; alert?: boolean }) {
  return (
    <div className={`rounded-md border bg-card p-5 ${
      alert ? "border-red-300 dark:border-red-800" :
      ok    ? "border-green-300 dark:border-green-800" :
      "border-border"
    }`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
      <div className={`text-2xl font-bold tabular-nums tracking-tight ${
        alert ? "text-red-600 dark:text-red-400" :
        ok    ? "text-green-600 dark:text-green-400" :
        "text-foreground"
      }`}>
        {value}
      </div>
    </div>
  );
}
