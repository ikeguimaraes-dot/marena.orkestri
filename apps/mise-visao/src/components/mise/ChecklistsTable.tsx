import type { ChecklistRow } from "@/lib/mise/checklists";
import type { Unit } from "@/lib/mise/units";

export function ChecklistsTable({ rows, units }: { rows: ChecklistRow[]; units: Unit[] }) {
  const unitName = (unitId: string) => units.find((u) => u.id === unitId)?.name ?? "—";

  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Últimos checklists</h2>

      {rows.length === 0 ? (
        <p style={{ color: "var(--text-2)", fontSize: 13 }}>
          Nenhum checklist executado — o MISE ainda não entrou em operação.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-3)", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "6px 10px" }}>Template</th>
                <th style={{ padding: "6px 10px" }}>Unidade</th>
                <th style={{ padding: "6px 10px" }}>Data</th>
                <th style={{ padding: "6px 10px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "8px 10px" }}>{row.templateNome}</td>
                  <td style={{ padding: "8px 10px" }}>{unitName(row.unitId)}</td>
                  <td style={{ padding: "8px 10px" }}>
                    {row.iniciadoEm ? new Date(row.iniciadoEm).toLocaleString("pt-BR") : "—"}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <span>{row.status ?? "—"}</span>
                    {row.hasOpenActionPlan && (
                      <span
                        title="Plano de ação em aberto"
                        style={{
                          marginLeft: 8,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "rgba(252,211,77,0.12)",
                          border: "1px solid rgba(252,211,77,0.4)",
                          color: "#FCD34D",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        Plano em aberto
                      </span>
                    )}
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
