import Link from "next/link";
import { Eye, Pencil } from "lucide-react";

import type { EventListRow } from "@/lib/eventos/types";
import { StatusBadge } from "./StatusBadge";

const TH: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "var(--text-3)",
  borderBottom: "1px solid var(--border)",
  background: "var(--surface-2)",
};

const TD: React.CSSProperties = {
  padding: "13px 16px",
  fontSize: 13,
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

function tituloOS(e: EventListRow): string {
  const d = e.data_inicio
    ? new Date(e.data_inicio).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
    : null;
  return d ? `O.S. "${e.nome}" — ${d}` : `O.S. "${e.nome}"`;
}

export function EventosTable({ events }: { events: EventListRow[] }) {
  if (events.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "var(--text-3)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 12 }}>📋</div>
        <p style={{ fontSize: 14 }}>Nenhum evento encontrado.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={TH}>Evento</th>
            <th style={TH}>Marca</th>
            <th style={TH}>Data</th>
            <th style={TH}>Pax</th>
            <th style={TH}>Op.</th>
            <th style={TH}>Status</th>
            <th style={{ ...TH, textAlign: "right" }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td style={TD}>
                <strong>{tituloOS(e)}</strong>
                <br />
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {e.tipo ?? ""}
                </span>
              </td>
              <td style={TD}>
                {e.brand_color && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: 99,
                      background: e.brand_color,
                      marginRight: 6,
                      verticalAlign: "middle",
                    }}
                  />
                )}
                {e.brand_name ?? "—"}
              </td>
              <td style={TD}>
                {e.data_inicio
                  ? new Date(e.data_inicio).toLocaleDateString("pt-BR")
                  : "—"}
              </td>
              <td style={TD}>{e.num_convidados ?? "—"}</td>
              <td style={TD}>{e.responsavel_operacional ?? "—"}</td>
              <td style={TD}>
                <StatusBadge status={e.status} />
              </td>
              <td style={{ ...TD, textAlign: "right", whiteSpace: "nowrap" }}>
                <Link
                  href={`/eventos/${e.id}`}
                  style={LINK_GHOST}
                  aria-label="Ver"
                >
                  <Eye size={14} /> Ver
                </Link>
                <Link
                  href={`/eventos/${e.id}/editar`}
                  style={{ ...LINK_GHOST, marginLeft: 6 }}
                  aria-label="Editar"
                >
                  <Pencil size={14} /> Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const LINK_GHOST: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  fontSize: 12,
  color: "var(--text-2)",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  textDecoration: "none",
  fontWeight: 600,
};
