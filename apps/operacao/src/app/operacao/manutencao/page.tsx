import { Suspense } from "react";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import { redirect } from "next/navigation";
import { getChamados, getAprovacoes } from "./actions";
import { ManutencaoClient } from "./manutencao-client";

export const dynamic = "force-dynamic";

const ROLES_PERMITIDOS = ["operacao", "founder", "administrativo"] as const;

export default async function ManutencaoPage() {
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
        <ManutencaoSection />
      </Suspense>
    </div>
  );
}

async function ManutencaoSection() {
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
        Selecione uma unidade no topo para ver a manutenção.
      </div>
    );
  }

  const [chamados, aprovacoes] = await Promise.all([
    getChamados(unit.id),
    getAprovacoes(unit.id),
  ]);

  return (
    <ManutencaoClient
      unit={{ id: unit.id, name: unit.name }}
      chamadosIniciais={chamados}
      aprovacoesIniciais={aprovacoes}
    />
  );
}
