import { classifyValidade, formatRemaining, nowIso } from "@/lib/mise/dates";
import type { UpcomingLabel } from "@/lib/mise/labels";

const URGENCY_COLOR: Record<string, string> = {
  vencida: "#FCA5A5",
  proxima: "#FCD34D",
  normal: "var(--text)",
};

export function LabelsTable({ rows, total }: { rows: UpcomingLabel[]; total: number }) {
  const nowMs = new Date(nowIso()).getTime();

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Etiquetas a vencer</h2>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{total} no total</span>
      </div>

      {rows.length === 0 ? (
        <p style={{ color: "var(--text-2)", fontSize: 13 }}>
          Nenhuma etiqueta registrada — o MISE ainda não entrou em operação.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-3)", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "6px 10px" }}>Produto</th>
                <th style={{ padding: "6px 10px" }}>Lote</th>
                <th style={{ padding: "6px 10px" }}>Setor</th>
                <th style={{ padding: "6px 10px" }}>Conservação</th>
                <th style={{ padding: "6px 10px" }}>Responsável</th>
                <th style={{ padding: "6px 10px" }}>Validade</th>
                <th style={{ padding: "6px 10px" }}>Tempo restante</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const urgency = classifyValidade(row.validade, nowMs);
                const color = URGENCY_COLOR[urgency];
                return (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "8px 10px", color }}>{row.nome}</td>
                    <td style={{ padding: "8px 10px", color }}>{row.lote ?? "—"}</td>
                    <td style={{ padding: "8px 10px", color }}>{row.setor ?? "—"}</td>
                    <td style={{ padding: "8px 10px", color }}>{row.metodo_conservacao ?? "—"}</td>
                    <td style={{ padding: "8px 10px", color }}>{row.responsavel_nome ?? "—"}</td>
                    <td style={{ padding: "8px 10px", color }}>{new Date(row.validade).toLocaleString("pt-BR")}</td>
                    <td style={{ padding: "8px 10px", color, fontWeight: 600 }}>{formatRemaining(row.validade, nowMs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
