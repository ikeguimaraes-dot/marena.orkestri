"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Error boundary do segment (dashboard). Captura erros lançados em qualquer
 * Server Component dentro de /pessoas, /, etc — em vez do 500 genérico.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard/error] caught:", error);
  }, [error]);

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "60px auto",
        padding: "32px 28px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
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
          color: "var(--destructive)",
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
            color: "var(--text-3)",
          }}
        >
          Erro na página
        </div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            margin: "6px 0 0",
            color: "var(--text)",
            letterSpacing: -0.3,
          }}
        >
          Algo quebrou ao carregar este painel
        </h2>
      </div>
      <p
        style={{
          fontSize: 12,
          color: "var(--text-2)",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {error.message || "Erro inesperado durante a renderização do servidor."}
        {error.digest && (
          <span
            style={{
              display: "block",
              marginTop: 6,
              color: "var(--text-3)",
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: 10,
            }}
          >
            digest {error.digest}
          </span>
        )}
      </p>
      <button
        onClick={() => reset()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: "var(--brand)",
          color: "var(--primary-foreground)",
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
    </div>
  );
}
