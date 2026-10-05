import { Suspense } from "react";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { listChecklists, listChecklistRecords } from "./actions";
import { AuditoriasClient } from "./auditorias-client";

export const dynamic = "force-dynamic";

export default async function AuditoriasPage() {
  await requireUser();
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Operação · Auditorias
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            margin: "6px 0 4px",
            color: "var(--text)",
            letterSpacing: -0.4,
          }}
        >
          Controle de Qualidade
        </h1>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            margin: 0,
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          Checklists diários por turno — cozinha, bar, salão e higiene.
          Histórico com score de conformidade.
        </p>
      </header>
      <Suspense
        fallback={
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>
            Carregando…
          </div>
        }
      >
        <AuditoriasSection />
      </Suspense>
    </div>
  );
}

async function AuditoriasSection() {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 8,
          padding: "32px 22px",
          textAlign: "center",
          color: "var(--text-3)",
          fontSize: 13,
        }}
      >
        Selecione uma unit no topo para ver os checklists.
      </div>
    );
  }
  const [checklists, records] = await Promise.all([
    listChecklists(unit.id),
    listChecklistRecords(unit.id, 30),
  ]);
  return (
    <AuditoriasClient
      unitId={unit.id}
      unitName={unit.name}
      checklists={checklists}
      records={records}
    />
  );
}
