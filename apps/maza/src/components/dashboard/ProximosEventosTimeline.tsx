import Link from "next/link";

import type { ProximoEventoRow, AlertaRow, EventStatus } from "@maza/db/types/database";
import { STATUS_COLORS, STATUS_LABEL } from "@/lib/eventos/labels";
import { currencyFmt, formatarDataRelativa } from "@/lib/dashboard/utils";

type Props = {
  eventos: ProximoEventoRow[];
  alertas: AlertaRow[];
};

export function ProximosEventosTimeline({ eventos, alertas }: Props) {
  if (eventos.length === 0) {
    return (
      <div
        style={{
          padding: "28px 22px",
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 14,
          textAlign: "center",
          fontSize: 13,
          color: "var(--text-3)",
        }}
      >
        Nenhum evento confirmado nos próximos 30 dias.
      </div>
    );
  }

  // Index pra detectar quais eventos têm alerta ativo.
  const alertSet = new Set(alertas.map((a) => a.resource_id));

  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {eventos.map((ev) => {
        const status = ev.status as EventStatus;
        const colors = STATUS_COLORS[status];
        const hasAlerta = alertSet.has(ev.id);
        return (
          <li key={ev.id}>
            <Link
              href={`/eventos/${ev.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr auto",
                alignItems: "center",
                gap: 16,
                padding: "12px 16px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                textDecoration: "none",
                color: "inherit",
                transition: "border-color var(--t)",
              }}
            >
              <time
                dateTime={ev.data_inicio}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-2)",
                }}
              >
                {formatarDataRelativa(new Date(ev.data_inicio))}
              </time>

              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: ev.brand_color || "var(--brand)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ev.nome}
                    {hasAlerta && (
                      <span
                        title="Tem alertas operacionais"
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          color: "#EF4444",
                          fontWeight: 700,
                        }}
                      >
                        ⚠
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ev.brand_name}
                    {ev.unit_name ? ` · ${ev.unit_name}` : ""}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <Pill
                  bg={colors.bg}
                  border={colors.border}
                  fg={colors.fg}
                >
                  {STATUS_LABEL[status]}
                </Pill>
                {ev.num_convidados != null && (
                  <Pill>{ev.num_convidados} pax</Pill>
                )}
                {ev.valor_total != null && (
                  <Pill accent>{currencyFmt.format(ev.valor_total)}</Pill>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Pill({
  children,
  bg,
  border,
  fg,
  accent,
}: {
  children: React.ReactNode;
  bg?: string;
  border?: string;
  fg?: string;
  accent?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 9px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        background: bg ?? "var(--surface-2)",
        border: `1px solid ${border ?? "var(--border)"}`,
        color: accent ? "var(--brand)" : (fg ?? "var(--text-2)"),
        borderRadius: 99,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
