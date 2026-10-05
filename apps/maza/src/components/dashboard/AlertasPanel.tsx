"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import type { AlertaRow } from "@maza/db/types/database";
import { dateTimeFmt } from "@/lib/dashboard/utils";

type Props = {
  alertas: AlertaRow[];
};

export function AlertasPanel({ alertas }: Props) {
  const hasCriticos = alertas.some((a) => a.severidade === "error");
  const [open, setOpen] = useState<boolean>(hasCriticos);

  if (alertas.length === 0) {
    return (
      <section
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "16px 18px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12,
          color: "var(--text-3)",
        }}
      >
        <span style={{ color: "#22C55E", fontWeight: 700 }}>✓</span> Nenhum
        alerta operacional. Tudo certo no grupo.
      </section>
    );
  }

  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text)",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: -0.2,
          textAlign: "left",
        }}
        aria-expanded={open}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          Alertas operacionais
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 99,
              background: hasCriticos
                ? "rgba(239,68,68,0.10)"
                : "rgba(234,179,8,0.10)",
              color: hasCriticos ? "#EF4444" : "#EAB308",
              border: `1px solid ${hasCriticos ? "rgba(239,68,68,0.40)" : "rgba(234,179,8,0.40)"}`,
            }}
          >
            {alertas.length}
          </span>
        </span>
        <ChevronDown
          size={14}
          style={{
            color: "var(--text-3)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform var(--t)",
          }}
        />
      </button>

      {open && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            borderTop: "1px solid var(--border)",
          }}
        >
          {alertas.map((a, i) => (
            <li
              key={`${a.tipo_alerta}:${a.resource_id}:${i}`}
              style={{
                padding: "12px 18px",
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <SeverityIcon severidade={a.severidade} />

              <div style={{ flex: 1, minWidth: 0, wordBreak: "break-word", overflowWrap: "break-word" }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text)",
                    fontWeight: 500,
                    lineHeight: 1.45,
                  }}
                >
                  {a.mensagem}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-3)",
                    marginTop: 2,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {a.brand_name} · {dateTimeFmt.format(new Date(a.created_at))}
                </div>
              </div>

              {a.resource_id && (
                <Link
                  href={`/eventos/${a.resource_id}`}
                  style={{
                    fontSize: 11,
                    color: "var(--brand)",
                    textDecoration: "none",
                    fontWeight: 600,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  Ver O.S. →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SeverityIcon({ severidade }: { severidade: "warning" | "error" }) {
  const isError = severidade === "error";
  return (
    <span
      aria-hidden
      title={isError ? "Crítico" : "Atenção"}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: isError ? "rgba(239,68,68,0.10)" : "rgba(234,179,8,0.10)",
        border: `1px solid ${isError ? "rgba(239,68,68,0.40)" : "rgba(234,179,8,0.40)"}`,
        color: isError ? "#EF4444" : "#EAB308",
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      {isError ? "!" : "⚠"}
    </span>
  );
}
