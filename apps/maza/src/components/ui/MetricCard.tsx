"use client";
/**
 * MetricCard — KPI card com Fraunces + detalhe Ouro + delta badge.
 * Implementa a "Opção A" do design brief: linha Ouro 1.5px no topo.
 *
 * Uso:
 *   <MetricCard label="Receita hoje" value="R$ 18.420" delta="+12%" trend="up" />
 */
import type { ReactNode } from "react";

type Trend = "up" | "down" | "neutral";

type Props = {
  label: string;
  value: ReactNode;
  delta?: string;
  trend?: Trend;
  sub?: ReactNode;
  /** Ícone Lucide (16px) no canto superior direito */
  trailing?: ReactNode;
  /** Conteúdo extra abaixo (barra de progresso, badges, etc.) */
  children?: ReactNode;
  /** Override cor do label. Default: var(--text-3) */
  accent?: string;
  className?: string;
};

const TREND_COLOR: Record<Trend, string> = {
  up:      "var(--color-success, #4ADE80)",
  down:    "var(--color-danger,  #FCA5A5)",
  neutral: "var(--text-3, #8A8278)",
};
const TREND_ICON: Record<Trend, string> = { up: "↑", down: "↓", neutral: "—" };

export function MetricCard({
  label,
  value,
  delta,
  trend = "neutral",
  sub,
  trailing,
  children,
  accent,
  className,
}: Props) {
  const trendColor = TREND_COLOR[trend];

  return (
    <article
      className={className}
      style={{
        position: "relative",
        background: "var(--surface, #1A1A18)",
        border: "1px solid var(--border-soft, rgba(245,240,232,0.08))",
        borderRadius: "var(--r-xl, 14px)",
        padding: "18px 20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 128,
        transition: "border-color var(--t, 180ms ease), box-shadow var(--t, 180ms ease)",
        cursor: "default",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "rgba(196,98,45,0.30)";
        el.style.boxShadow = "var(--shadow-brasa, 0 0 20px rgba(196,98,45,0.12))";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--border-soft, rgba(245,240,232,0.08))";
        el.style.boxShadow = "none";
      }}
    >
      {/* Linha Ouro topo — detalhe premium */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "1.5px",
          background: "linear-gradient(90deg, var(--ouro, #B8975A) 0%, transparent 65%)",
          borderRadius: "14px 14px 0 0",
        }}
      />

      {/* Header: label + trailing */}
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
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
        {trailing && (
          <span style={{ color: "var(--text-3, #8A8278)", flexShrink: 0 }}>{trailing}</span>
        )}
      </header>

      {/* Valor principal em Fraunces */}
      <div
        className="anim-count-up"
        style={{
          fontSize: "1.875rem",
          fontWeight: 300,
          fontFamily: "var(--font-display, Georgia, serif)",
          color: "var(--text, #F5F0E8)",
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
        }}
        aria-label={`${label}: ${value}`}
      >
        {value}
      </div>

      {/* Sub + delta */}
      {(sub ?? delta) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -4 }}>
          {sub && (
            <span style={{ fontSize: "0.6875rem", color: "var(--text-3, #8A8278)" }}>{sub}</span>
          )}
          {delta && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: "0.6875rem",
                fontWeight: 700,
                color: trendColor,
                background: `color-mix(in srgb, ${trendColor} 10%, transparent)`,
                padding: "2px 7px",
                borderRadius: "9999px",
                letterSpacing: "0.02em",
              }}
            >
              <span aria-hidden="true">{TREND_ICON[trend]}</span>
              {delta}
            </span>
          )}
        </div>
      )}

      {children && <div style={{ marginTop: 2 }}>{children}</div>}
    </article>
  );
}
