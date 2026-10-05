import { requireUser } from "@kph/auth/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ROLES_PERMITIDOS = ["pessoas", "gm", "founder"] as const;

export default async function FormularioRecrutamentoPage() {
  const user = await requireUser();
  const temAcesso = user.roles.some((r) =>
    (ROLES_PERMITIDOS as readonly string[]).includes(r.role),
  );
  if (!temAcesso) redirect("/operacao");

  redirect("/recrutamento/vagas");
}
