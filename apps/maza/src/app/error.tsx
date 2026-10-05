"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global/error] caught:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background, #0A0A0B)",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: "36px 28px",
            background: "var(--surface, #131316)",
            border: "1px solid rgba(245,240,232,0.08)",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "rgba(239,68,68,0.12)",
              color: "#EF4444",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "var(--text-3, #71717A)",
              }}
            >
              Marena
            </div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                margin: "6px 0 0",
                color: "var(--text, #E5E5E7)",
                letterSpacing: -0.3,
              }}
            >
              Algo deu errado
            </h1>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-2, #A1A1AA)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {error.message || "Ocorreu um erro inesperado no sistema."}
            {error.digest && (
              <span
                style={{
                  display: "block",
                  marginTop: 6,
                  color: "var(--text-3, #71717A)",
                  fontFamily: "monospace",
                  fontSize: 10,
                }}
              >
                digest {error.digest}
              </span>
            )}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={() => reset()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "#C4622D",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RotateCw size={14} />
              Tentar de novo
            </button>
            <Link
              href="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 14px",
                background: "var(--surface-2, #1A1A1E)",
                color: "var(--text-2, #A1A1AA)",
                border: "1px solid rgba(245,240,232,0.08)",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
