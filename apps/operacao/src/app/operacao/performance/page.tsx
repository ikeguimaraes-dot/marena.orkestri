// src/app/(dashboard)/operacao/performance/page.tsx
import { Suspense } from "react";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { getPerformanceKpis } from "./actions";
import { PerformanceClient } from "./performance-client";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Operação · Performance
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          KPIs Operacionais
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Headcount, absenteísmo, horas extras e score de auditorias no período selecionado.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <PerformanceSection />
      </Suspense>
    </div>
  );
}

async function PerformanceSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver os KPIs.
      </div>
    );
  }
  const hoje = new Date();
  const kpis = await getPerformanceKpis(unit.id, hoje.getMonth() + 1, hoje.getFullYear());
  return <PerformanceClient unitName={unit.name} kpis={kpis} mes={hoje.getMonth() + 1} ano={hoje.getFullYear()} />;
}
