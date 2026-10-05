import Link from "next/link";
import { LogOut, UserX } from "lucide-react";

import { PontoApp } from "@/components/ponto/PontoApp";
import { getMyEmployee, getTodayPunches } from "@/lib/pessoas/actions";
import { requireUser } from "@maza/auth/server";

export const dynamic = "force-dynamic";

export default async function PontoPage() {
  const user = await requireUser();
  const employee = await getMyEmployee(user.id);

  if (!employee) {
    return <NoEmployeeBound email={user.email} />;
  }

  const punches = await getTodayPunches(employee.id);

  return (
    <PontoApp
      employeeId={employee.id}
      employeeName={`${employee.nome} ${employee.sobrenome}`.trim()}
      employeeFuncao={employee.funcao}
      initialPunches={punches}
    />
  );
}

function NoEmployeeBound({ email }: { email: string | null }) {
  return (
    <div
      style={{
        marginTop: 48,
        padding: "32px 22px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 99,
          background: "rgba(239,68,68,0.12)",
          color: "var(--destructive)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <UserX size={24} />
      </div>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          Sua conta não está vinculada a um colaborador
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5, margin: "8px 0 0" }}>
          Acessou como{" "}
          <span style={{ color: "var(--text-2)", fontFamily: "var(--font-geist-mono)" }}>
            {email ?? "—"}
          </span>
          . Pra registrar ponto, peça pro GM vincular sua conta ao seu cadastro
          de colaborador no painel.
        </p>
      </div>
      <Link
        href="/auth/sign-out"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          color: "var(--text-2)",
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        <LogOut size={14} />
        Sair
      </Link>
    </div>
  );
}
