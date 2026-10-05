import { Suspense } from "react";
import Link from "next/link";
import { InsightPanel } from "@/components/intelligence/InsightPanel";
import { Plus } from "lucide-react";

import {
  getEventStats,
  listAccessibleBrands,
  listEvents,
} from "./actions";
import { EventosFilters } from "@/components/eventos/EventosFilters";
import { EventosTable } from "@/components/eventos/EventosTable";
import type { EventStatus } from "@maza/db/types/database";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  brand?: string;
  status?: string;
  q?: string;
}>;

export default async function EventosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  let brands, stats, events
  try {
    ;[brands, stats, events] = await Promise.all([
      listAccessibleBrands(),
      getEventStats(),
      listEvents({
        brand_id: sp.brand || null,
        status: (sp.status as EventStatus) || null,
        search: sp.q || null,
      }),
    ])
  } catch (e: any) {
    return (
      <div style={{ padding: 40, color: 'red', fontFamily: 'monospace' }}>
        <h2>ERRO EM /eventos</h2>
        <pre>{e?.message}</pre>
        <pre>{e?.stack}</pre>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: -0.4,
              margin: 0,
            }}
          >
            Eventos
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
            Todas as ordens de serviço
          </p>
        </div>
        <Link
          href="/eventos/novo"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            borderRadius: 6,
            background: "var(--brand)",
            color: "#0a0a0a",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <Plus size={14} /> Nova O.S.
        </Link>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Stat label="Total de Eventos" value={stats.total} sub="cadastrados" />
        <Stat
          label="Confirmados"
          value={stats.confirmados}
          sub="próximos"
        />
        <Stat label="Rascunhos" value={stats.rascunhos} sub="em aberto" />
        <Stat label="Realizados" value={stats.realizados} sub="histórico" />
      </div>

      <Suspense fallback={null}>
        <EventosFilters brands={brands} />
      </Suspense>

      <EventosTable events={events} />

      <InsightPanel
        module="operacao"
        context={{
          total_eventos: stats.total,
          confirmados: stats.confirmados,
          rascunhos: stats.rascunhos,
          realizados: stats.realizados,
        }}
        title="Insight Operacional"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--text-3)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 32,
          color: "var(--brand)",
          fontWeight: 700,
          letterSpacing: -1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
        {sub}
      </div>
    </div>
  );
}
