import { Suspense } from "react";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { redirect } from "next/navigation";
import { getProdutos, getPedidosRecentes, getPedidosParaRecebimento } from "./actions";
import { PedidosClient } from "./pedidos-client";

export const dynamic = "force-dynamic";

const ROLES_PERMITIDOS = ["operacao", "founder", "administrativo"] as const;

export default async function PedidosPage() {
  const user = await requireUser();
  const temAcesso = user.roles.some((r) =>
    (ROLES_PERMITIDOS as readonly string[]).includes(r.role),
  );
  if (!temAcesso) redirect("/operacao");

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <Suspense
        fallback={
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>
            Carregando…
          </div>
        }
      >
        <PedidosSection userId={user.id} />
      </Suspense>
    </div>
  );
}

async function PedidosSection({ userId }: { userId: string }) {
  const unit = await getCurrentUnit();
  if (!unit) {
    return (
      <div
        style={{
          color: "var(--text-3)",
          fontSize: 13,
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Selecione uma unidade no topo para ver os pedidos.
      </div>
    );
  }
  const [produtos, pedidos, pedidosRecebimento] = await Promise.all([
    getProdutos(unit.id),
    getPedidosRecentes(unit.id),
    getPedidosParaRecebimento(unit.id),
  ]);
  return (
    <PedidosClient
      unit={{ id: unit.id, name: unit.name, brand_id: unit.brand_id ?? null }}
      userId={userId}
      produtos={produtos}
      pedidosIniciais={pedidos}
      pedidosParaRecebimento={pedidosRecebimento}
    />
  );
}
