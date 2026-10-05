import Link from "next/link";
import { listPayrollReports } from "./actions";
import { RelatoriosClient } from "./relatorios-client";

export const dynamic = "force-dynamic";

export default async function RelatoriosFolhaPage() {

  const relatorios = await listPayrollReports();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Link
        href="/financeiro"
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          textDecoration: "none",
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        ← Financeiro
      </Link>

      <header style={{ margin: "10px 0 28px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          Relatórios de Folha
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          Upload de folha mensal, adiantamento e relatório bancário.
          Acesso restrito ao time de RH / Financeiro.
        </p>
      </header>

      <RelatoriosClient relatorios={relatorios} />
    </div>
  );
}
