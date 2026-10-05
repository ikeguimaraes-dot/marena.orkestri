import { Suspense } from "react";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { listRestaurantTables } from "./actions";
import { MapaClient } from "./mapa-client";

export const dynamic = "force-dynamic";

export default async function MapaPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <Suspense fallback={null}>
        <OperacaoInsightPanel />
      </Suspense>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: "var(--text-3)" }}>
          Operação · Mapa da Casa
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "6px 0 4px", color: "var(--text)", letterSpacing: -0.4 }}>
          Mapa da Casa
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.55, maxWidth: 720 }}>
          Status das mesas em tempo real. Clique em uma mesa para alterar o status. Reservas do dia são marcadas automaticamente.
        </p>
      </header>
      <Suspense fallback={<div style={{ color: "var(--text-3)", fontSize: 13 }}>Carregando…</div>}>
        <MapaSection />
      </Suspense>
    </div>
  );
}

async function OperacaoInsightPanel() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const today = new Date().toISOString().split("T")[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("kph_insights")
      .select("insight_text, dados_referencia, created_at")
      .eq("modulo", "operacao")
      .gte("created_at", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    const score = typeof data.dados_referencia?.score === "number" ? data.dados_referencia.score : null;
    const scoreColor =
      score === null ? "var(--text-3)"
      : score >= 80 ? "#15803D"
      : score >= 60 ? "#A16207"
      : "#B91C1C";

    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "14px 18px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
        }}>
          <div style={{ flexShrink: 0, marginTop: 2 }}>
            <span style={{ fontSize: 18 }}>🤖</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-3)" }}>
                IA · Operação · Hoje
              </span>
              {score !== null && (
                <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor }}>
                  Score {score}/100
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.55 }}>
              {data.insight_text}
            </p>
          </div>
        </div>
      </div>
    );
  } catch {
    return null;
  }
}

async function MapaSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: "32px 22px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        Selecione uma unit no topo para ver o mapa.
      </div>
    );
  }
  const tables = await listRestaurantTables(unit.id);
  return <MapaClient unitId={unit.id} unitName={unit.name} tables={tables} />;
}
