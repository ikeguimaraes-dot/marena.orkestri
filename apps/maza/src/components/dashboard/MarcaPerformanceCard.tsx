import type { KpiMesAtual } from "@/lib/dashboard/types";
import type { HeadcountMarcaRow } from "@maza/db/types/database";
import { ProgressBar } from "./ProgressBar";
import { VariacaoBadge } from "./VariacaoBadge";
import { currencyFmt, currencyFullFmt } from "@/lib/dashboard/utils";

type Props = {
  kpi: KpiMesAtual;
  headcount: HeadcountMarcaRow | null;
};

export function MarcaPerformanceCard({ kpi, headcount }: Props) {
  const hasMes = !!kpi.mes_atual;
  const previsto = kpi.mes_atual?.receita_prevista ?? 0;
  const realizado = kpi.mes_atual?.receita_realizada ?? 0;
  const total = kpi.mes_atual?.total_eventos ?? 0;
  const concluidos = kpi.mes_atual?.eventos_concluidos ?? 0;
  const pendentes = kpi.mes_atual?.eventos_pendentes ?? 0;
  const pctRealizado = previsto > 0 ? (realizado / previsto) * 100 : 0;

  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "16px 18px 18px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: kpi.brand_color || "var(--brand)",
        }}
      />

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 99,
              background: kpi.brand_color || "var(--brand)",
            }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text)",
              letterSpacing: -0.2,
            }}
          >
            {kpi.brand_name}
          </span>
        </div>
        {hasMes ? (
          <VariacaoBadge pct={kpi.variacao_receita_pct} />
        ) : (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "var(--text-3)",
              padding: "2px 8px",
              background: "var(--surface-2)",
              borderRadius: 99,
              border: "1px solid var(--border)",
            }}
          >
            Sem eventos
          </span>
        )}
      </header>

      {/* Receita prevista vs realizada */}
      <section style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            Receita
          </span>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            {Math.round(pctRealizado)}% realizado
          </span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
          {currencyFullFmt.format(realizado)}{" "}
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--text-3)",
              marginLeft: 2,
            }}
          >
            / {currencyFmt.format(previsto)}
          </span>
        </div>
        <div style={{ marginTop: 6 }}>
          <ProgressBar
            value={realizado}
            max={Math.max(previsto, 1)}
            color={kpi.brand_color || "var(--brand)"}
          />
        </div>
      </section>

      {/* Eventos do mês */}
      <section style={{ display: "flex", gap: 16, marginBottom: 14 }}>
        <Mini
          label="Total"
          value={total}
          color="var(--text)"
        />
        <Mini
          label="Concluídos"
          value={concluidos}
          color="#22C55E"
        />
        <Mini
          label="Pendentes"
          value={pendentes}
          color="#EAB308"
        />
      </section>

      {/* Headcount */}
      <section
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          paddingTop: 10,
          borderTop: "1px solid var(--border)",
        }}
      >
        {headcount
          ? `${headcount.headcount_ativo} colaboradores · ${currencyFmt.format(headcount.folha_bruta ?? 0)} folha`
          : "Sem dados de RH"}
      </section>
    </article>
  );
}

function Mini({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontSize: 9,
          color: "var(--text-3)",
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
