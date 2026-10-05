"use client";
import type { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  /** Linha curta abaixo do valor principal */
  sub?: ReactNode;
  /** Ícone ou pílula no canto superior direito */
  trailing?: ReactNode;
  /** Conteúdo adicional embaixo */
  children?: ReactNode;
  /** Cor de destaque pro label. Default --text-3 */
  accent?: string;
};

/** Card genérico de KPI — 4 colunas no topo do dashboard. */
export function KpiCard({ label, value, sub, trailing, children, accent }: Props) {
  return (
    <article
      className="anim-fade-up"
      style={{
        position: "relative",
        background: "var(--surface, #1A1A18)",
        border: "1px solid var(--border-soft, rgba(245,240,232,0.08))",
        borderRadius: "var(--r-xl, 14px)",
        padding: "18px 20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 130,
        transition: "border-color var(--t, 180ms ease), box-shadow var(--t, 180ms ease)",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "rgba(196,98,45,0.28)";
        el.style.boxShadow = "0 0 20px rgba(196,98,45,0.10)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--border-soft, rgba(245,240,232,0.08))";
        el.style.boxShadow = "none";
      }}
    >
      {/* Linha Ouro — detalhe premium */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "1.5px",
          background: "linear-gradient(90deg, var(--ouro, #B8975A) 0%, transparent 60%)",
          borderRadius: "14px 14px 0 0",
        }}
      />

      {/* Header */}
      <header
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}
      >
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: accent ?? "var(--text-3, #8A8278)",
            fontFamily: "var(--font-ui)",
          }}
        >
          {label}
        </span>
        {trailing}
      </header>

      {/* Valor — Fraunces font-weight 300, editorial */}
      <div
        style={{
          fontSize: "1.75rem",
          fontWeight: 300,
          fontFamily: "var(--font-display, Georgia, serif)",
          color: "var(--text, #F5F0E8)",
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>

      {sub && (
        <div style={{ fontSize: "0.6875rem", color: "var(--text-3, #8A8278)", marginTop: -2 }}>
          {sub}
        </div>
      )}

      {children && <div style={{ marginTop: 4 }}>{children}</div>}
    </article>
  );
}
