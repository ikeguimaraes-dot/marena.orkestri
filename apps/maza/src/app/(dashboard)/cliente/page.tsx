import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonVariants } from "@maza/ui/button";
import { listClients } from "@/app/(dashboard)/cliente/actions";
import { getCurrentUnit } from "@maza/auth/unit";
import { ClienteClient } from "./cliente-client";

export const dynamic = "force-dynamic";

export default async function ClientePage() {
  const unit = await getCurrentUnit();
  const clients = await listClients(unit?.id ?? null);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            Comercial · CRM
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
            Clientes
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
            {unit
              ? `Base de clientes da ${unit.name}.`
              : "Selecione uma unidade pra ver clientes."}
          </p>
        </div>
        <Link href="/cliente/novo" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo cliente
        </Link>
      </header>

      <ClienteClient clients={clients} />
    </div>
  );
}
