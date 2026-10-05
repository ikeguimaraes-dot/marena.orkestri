"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function OrquestradorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[orquestrador/error] caught:", error);
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
            color: "var(--text-3)",
          }}
        >
          Orquestrador — erro
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
          Falha ao carregar o Orquestrador
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
              fontFamily: "var(--font-geist-mono, monospace)",
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
            background: "var(--brand)",
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
            gap: 6,
            padding: "8px 14px",
            background: "var(--surface-2)",
            color: "var(--text-2)",
            border: "1px solid var(--border-soft)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          <ChevronLeft size={14} />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
