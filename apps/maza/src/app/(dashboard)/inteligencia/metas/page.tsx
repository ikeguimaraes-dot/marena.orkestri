import { createSupabaseServerClient } from "@maza/db/supabase/server";
import { InsightPanel } from "@/components/intelligence/InsightPanel";

export const dynamic = "force-dynamic";

type MetaRow = {
  id?: string;
  titulo?: string;
  meta_valor?: number;
  realizado?: number;
  unidade?: string;
  brand_name?: string;
  status?: string;
};

async function getMetas(): Promise<MetaRow[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data } = await (supabase as any)
      .from("brand_goals")
      .select("id, titulo, meta_valor, realizado, unidade, status, brands(name)")
      .order("created_at", { ascending: false })
      .limit(50);
    return ((data ?? []) as any[]).map((r) => ({
      ...r,
      brand_name: r.brands?.name ?? null,
    }));
  } catch {
    return [];
  }
}

export default async function MetasPage() {
  const metas = await getMetas();

  const total = metas.length;
  const atingidas = metas.filter((m) => m.status === "atingida" || (m.realizado != null && m.meta_valor != null && m.realizado >= m.meta_valor)).length;
  const emRisco = metas.filter((m) => {
    if (!m.realizado || !m.meta_valor) return false;
    return m.realizado / m.meta_valor < 0.7;
  }).length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", letterSpacing: -0.6, margin: 0 }}>
          Metas
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
          OKRs e metas estratégicas da Marena
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
        <KpiCard label="Total de metas" value={String(total)} />
        <KpiCard label="Atingidas" value={String(atingidas)} ok />
        <KpiCard label="Em risco" value={String(emRisco)} alert={emRisco > 0} />
        <KpiCard label="Em andamento" value={String(total - atingidas - emRisco)} />
      </div>

      {metas.length > 0 ? (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 28,
          }}
        >
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                {["Meta", "Marca", "Realizado", "Alvo", "Progresso"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: h === "Meta" || h === "Marca" ? "left" : "right",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                      color: "var(--text-3)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metas.map((m, i) => {
                const pct = m.meta_valor && m.realizado != null ? Math.round((m.realizado / m.meta_valor) * 100) : null;
                const isOk = pct != null && pct >= 100;
                const isRisk = pct != null && pct < 70;
                return (
                  <tr key={m.id ?? i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text)", maxWidth: 260 }}>
                      {m.titulo ?? "—"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-3)", fontSize: 12 }}>
                      {m.brand_name ?? "Grupo"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-2)" }}>
                      {m.realizado != null ? `${m.realizado} ${m.unidade ?? ""}`.trim() : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-2)" }}>
                      {m.meta_valor != null ? `${m.meta_valor} ${m.unidade ?? ""}`.trim() : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: isOk ? "#22C55E" : isRisk ? "#EF4444" : "#F59E0B" }}>
                      {pct != null ? `${pct}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-3)", fontSize: 14 }}>
          Nenhuma meta cadastrada. Adicione OKRs e metas estratégicas para acompanhar o progresso aqui.
        </div>
      )}

      <InsightPanel
        module="metas"
        context={{
          total_metas: total,
          metas_atingidas: atingidas,
          metas_em_risco: emRisco,
          taxa_atingimento: total > 0 ? Math.round((atingidas / total) * 100) : null,
          metas: metas.slice(0, 10).map((m) => ({
            titulo: m.titulo,
            marca: m.brand_name,
            realizado: m.realizado,
            alvo: m.meta_valor,
          })),
        }}
        title="Insight de Metas"
      />
    </div>
  );
}

function KpiCard({ label, value, ok, alert }: { label: string; value: string; ok?: boolean; alert?: boolean }) {
  const color = alert ? "#EF4444" : ok ? "#22C55E" : "var(--text)";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${alert ? "rgba(239,68,68,0.3)" : ok ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
        borderRadius: 8,
        padding: "18px 20px",
      }}
    >
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-3)", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: -0.4 }}>{value}</div>
    </div>
  );
}
