"use client";

import { useRef, useState, useTransition } from "react";
import {
  uploadPayrollReport,
  getPayrollReportUrl,
  type PayrollReport,
  type TipoRelatorio,
} from "./actions";

const TIPOS: { value: TipoRelatorio; label: string }[] = [
  { value: "folha_mensal", label: "Folha Mensal" },
  { value: "adiantamento", label: "Adiantamento" },
  { value: "relatorio_bancario", label: "Relatório Bancário" },
];

function gerarCompetencias(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    result.push(`${yyyy}-${mm}`);
  }
  return result;
}

function formatCompetencia(comp: string): string {
  const parts = comp.split("-");
  const yyyy = parts[0] ?? "";
  const mm = parts[1] ?? "01";
  const meses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${meses[parseInt(mm, 10) - 1] ?? mm}/${yyyy}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function RelatoriosClient({ relatorios }: { relatorios: PayrollReport[] }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [competencia, setCompetencia] = useState(gerarCompetencias()[0] ?? "");
  const [tipo, setTipo] = useState<TipoRelatorio>("folha_mensal");
  const fileRef = useRef<HTMLInputElement>(null);

  const competencias = gerarCompetencias();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErro("Selecione um arquivo PDF.");
      return;
    }

    const fd = new FormData();
    fd.set("file", file);
    fd.set("competencia", competencia);
    fd.set("tipo", tipo);

    startTransition(async () => {
      const result = await uploadPayrollReport(fd);
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      setSucesso(true);
      if (fileRef.current) fileRef.current.value = "";
      window.location.reload();
    });
  }

  async function handleAbrir(storagePath: string) {
    const result = await getPayrollReportUrl(storagePath);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    window.open(result.data.url, "_blank");
  }

  return (
    <div>
      {/* Upload form */}
      <section
        style={{
          background: "var(--card, #fff)",
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: 10,
          padding: "24px 28px",
          marginBottom: 32,
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 20 }}>
          Enviar relatório
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 160px" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Competência
              </span>
              <select
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                style={selectStyle}
              >
                {competencias.map((c) => (
                  <option key={c} value={c}>{formatCompetencia(c)}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 200px" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Tipo
              </span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoRelatorio)}
                style={selectStyle}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: "2 1 260px" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Arquivo PDF
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                style={inputStyle}
              />
            </label>
          </div>

          {erro && (
            <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{erro}</p>
          )}
          {sucesso && (
            <p style={{ fontSize: 13, color: "#16a34a", marginBottom: 12 }}>
              Relatório enviado com sucesso.
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            style={buttonStyle(isPending)}
          >
            {isPending ? "Enviando..." : "Enviar relatório"}
          </button>
        </form>
      </section>

      {/* Tabela */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>
          Relatórios enviados
        </h2>

        {relatorios.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--text-3)" }}>Nenhum relatório enviado ainda.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border, #e5e7eb)" }}>
                {["Arquivo", "Competência / Tipo", "Enviado em", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-3)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      padding: "8px 12px",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {relatorios.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                  <td style={tdStyle}>{r.name}</td>
                  <td style={tdStyle}>{r.notes ?? "—"}</td>
                  <td style={tdStyle}>{formatDate(r.uploaded_at)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <button
                      onClick={() => handleAbrir(r.storage_path)}
                      style={linkButtonStyle}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--text)",
  background: "var(--bg, #f9fafb)",
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 6,
  padding: "8px 10px",
  width: "100%",
};

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text)",
  background: "var(--bg, #f9fafb)",
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 6,
  padding: "7px 10px",
  width: "100%",
};

const tdStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text)",
  padding: "12px",
  verticalAlign: "middle",
};

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "#9ca3af" : "var(--primary, #c4622d)",
    color: "#fff",
    border: "none",
    borderRadius: 7,
    padding: "10px 22px",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 6,
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--primary, #c4622d)",
  cursor: "pointer",
};
