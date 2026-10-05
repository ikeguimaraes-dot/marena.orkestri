import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getEventDetail } from "../actions";
import { EventActions } from "@/components/eventos/EventActions";
import { EventDetail } from "@/components/eventos/EventDetail";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EventoViewPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const detail = await getEventDetail(id);
  if (!detail) notFound();

  const { event } = detail;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 12,
          flexWrap: "wrap",
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
            Ordem de Serviço
          </h1>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Link
            href="/eventos"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 6,
              background: "transparent",
              color: "var(--text-3)",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              border: "1px solid var(--border)",
            }}
          >
            <ArrowLeft size={14} /> Voltar
          </Link>
          <EventActions eventId={event.id} status={event.status} />
        </div>
      </div>

      <EventDetail event={event} />
    </div>
  );
}
