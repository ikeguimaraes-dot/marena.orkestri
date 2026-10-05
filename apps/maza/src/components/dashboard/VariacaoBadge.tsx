type Props = {
  /** null → exibe "—" (sem base de comparação). */
  pct: number | null;
  /** Casas decimais. Default 0. */
  digits?: number;
};

/**
 * Badge de variação percentual: ↑12% verde / ↓8% vermelho / →0% neutro.
 */
export function VariacaoBadge({ pct, digits = 0 }: Props) {
  if (pct === null || Number.isNaN(pct)) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "2px 8px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.4,
          background: "rgba(148,163,184,0.12)",
          color: "#94A3B8",
          borderRadius: 99,
        }}
        aria-label="Sem comparação"
      >
        — sem base
      </span>
    );
  }

  const positivo = pct > 0;
  const neutro = Math.abs(pct) < 0.01;
  const arrow = neutro ? "→" : positivo ? "↑" : "↓";
  const colorMap = neutro
    ? { bg: "rgba(148,163,184,0.12)", fg: "#94A3B8" }
    : positivo
      ? { bg: "rgba(34,197,94,0.12)", fg: "#22C55E" }
      : { bg: "rgba(239,68,68,0.12)", fg: "#EF4444" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.4,
        background: colorMap.bg,
        color: colorMap.fg,
        borderRadius: 99,
      }}
    >
      <span aria-hidden>{arrow}</span>
      {Math.abs(pct).toFixed(digits)}%
    </span>
  );
}
