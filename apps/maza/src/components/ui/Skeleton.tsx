/**
 * Skeleton — shimmer loading placeholder com paleta MARENA.
 * NUNCA usar spinner isolado — sempre Skeleton para loading de dados.
 */
import type { CSSProperties } from "react";

type Props = {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: CSSProperties;
  className?: string;
};

export function Skeleton({ width = "100%", height = 16, borderRadius = "var(--r-md, 6px)", style, className }: Props) {
  return (
    <span
      className={`skeleton ${className ?? ""}`.trim()}
      role="status"
      aria-label="Carregando…"
      style={{
        display: "block",
        width,
        height,
        borderRadius,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/** Card skeleton — replica o shape de um MetricCard */
export function MetricCardSkeleton() {
  return (
    <div
      style={{
        background: "var(--surface, #1A1A18)",
        border: "1px solid var(--border-soft, rgba(245,240,232,0.08))",
        borderRadius: "var(--r-xl, 14px)",
        padding: "18px 20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 128,
      }}
    >
      <Skeleton width={80} height={10} />
      <Skeleton width="55%" height={32} borderRadius={4} />
      <Skeleton width={120} height={10} />
    </div>
  );
}

/** Row skeleton para tabelas */
export function TableRowSkeleton({ cols = 4, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: "12px 14px" }}>
              <Skeleton height={12} width={j === 0 ? "70%" : "50%"} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
