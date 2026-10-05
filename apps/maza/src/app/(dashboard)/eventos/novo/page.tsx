import Link from "next/link";

import { createEvent, listAccessibleBrands } from "../actions";
import { EventForm } from "@/components/eventos/EventForm";

export const dynamic = "force-dynamic";

export default async function NovoEventoPage() {
  const brands = await listAccessibleBrands();

  if (brands.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>
          Nova Ordem de Serviço
        </h1>
        <div
          style={{
            marginTop: 24,
            padding: 32,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            textAlign: "center",
            color: "var(--text-3)",
          }}
        >
          Você ainda não tem acesso a nenhuma marca. Peça pra um founder
          atribuir uma role pra você.
        </div>
      </div>
    );
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
            Nova Ordem de Serviço
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
            Preencha todos os campos operacionais
          </p>
        </div>
        <Link
          href="/eventos"
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
        onSubmit={createEvent}
        submitLabel="Salvar O.S."
      />
    </div>
  );
}
