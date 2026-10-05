import type { PrinterRankingRow } from "@/lib/mise/ranking";

export function PrinterRanking({ rows }: { rows: PrinterRankingRow[] }) {
  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Quem imprimiu (mês atual)</h2>

      {rows.length === 0 ? (
        <p style={{ color: "var(--text-2)", fontSize: 13 }}>
          Nenhuma impressão registrada este mês — o MISE ainda não entrou em operação.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-3)", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "6px 10px" }}>Responsável</th>
                <th style={{ padding: "6px 10px" }}>Quantidade</th>
                <th style={{ padding: "6px 10px" }}>Última impressão</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.nome} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "8px 10px" }}>{row.nome}</td>
                  <td style={{ padding: "8px 10px" }}>{row.quantidade}</td>
                  <td style={{ padding: "8px 10px" }}>
                    {row.ultimaImpressao ? new Date(row.ultimaImpressao).toLocaleString("pt-BR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
