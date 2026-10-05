import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getEventDetail,
  listAccessibleBrands,
  updateEvent,
} from "../../actions";
import { EventForm } from "@/components/eventos/EventForm";
import type { EventFormValues } from "@/lib/eventos/schema";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EventoEditarPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const [detail, brands] = await Promise.all([
    getEventDetail(id),
    listAccessibleBrands(),
  ]);
  if (!detail) notFound();

  // Bind do id na Server Action — o EventForm chama onSubmit(values).
  async function submit(values: EventFormValues) {
    "use server";
    return updateEvent(id, values);
  }

  return (
    <div>
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
            Editar O.S. — {detail.event.nome}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
            Edite os campos e salve para registrar nova versão
          </p>
        </div>
        <Link
          href={`/eventos/${id}`}
          style={{
            padding: "10px 20px",
            borderRadius: 6,
            background: "transparent",
            color: "var(--text-3)",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            border: "1px solid var(--border)",
          }}
        >
          Cancelar
        </Link>
      </div>

      <EventForm
        brands={brands}
        initial={detail.event}
        onSubmit={submit}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}
