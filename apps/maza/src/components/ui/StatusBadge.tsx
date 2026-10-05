/**
 * StatusBadge — badge semântico MARENA.
 * Cor + ícone + texto — NUNCA só cor (acessibilidade).
 *
 * Substitui os bg-blue-100 / text-blue-800 do orquestrador.
 */

type Variant = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

type Props = {
  variant?: Variant;
  /** Ponto • antes do texto se true */
  dot?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

const STYLES: Record<Variant, { bg: string; color: string }> = {
  success: { bg: "rgba(74,222,128,0.10)",  color: "#4ADE80"  },
  warning: { bg: "rgba(252,211,77,0.10)",  color: "#FCD34D"  },
  danger:  { bg: "rgba(252,165,165,0.10)", color: "#FCA5A5"  },
  info:    { bg: "rgba(196,98,45,0.12)",   color: "#C4622D"  },
  neutral: { bg: "rgba(245,240,232,0.06)", color: "#8A8278"  },
  purple:  { bg: "rgba(196,98,45,0.08)",   color: "#B8975A"  }, /* usa Ouro para "inteligência" */
};

export function StatusBadge({ variant = "neutral", dot = false, children, style }: Props) {
  const { bg, color } = STYLES[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: dot ? 5 : 0,
        padding: "3px 9px",
        borderRadius: "9999px",
        fontSize: "0.6875rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        background: bg,
        color,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
        whiteSpace: "nowrap",
        fontFamily: "var(--font-ui)",
        ...style,
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

/** Semáforo acessível — cor + ícone + texto */
type TrafficLightProps = {
  value: number;
  meta: number;
  /** % acima da meta que vira warning. Default: 5 */
  warnThreshold?: number;
  format?: (v: number) => string;
};

export function TrafficLight({ value, meta, warnThreshold = 5, format }: TrafficLightProps) {
  const pct = meta > 0 ? (value / meta) * 100 : 0;
  const label = format ? format(value) : `${value.toFixed(1)}%`;

  if (pct <= 100) {
    return (
      <StatusBadge variant="success" dot>
        <span aria-label={`Dentro da meta · ${label}`}>Dentro da meta · {label}</span>
      </StatusBadge>
    );
  }
  if (pct <= 100 + warnThreshold) {
    return (
      <StatusBadge variant="warning" dot>
        <span aria-label={`Atenção · ${label}`}>Atenção · {label}</span>
      </StatusBadge>
    );
  }
  return (
    <StatusBadge variant="danger" dot>
      <span aria-label={`Acima da meta · ${label}`}>Acima da meta · {label}</span>
    </StatusBadge>
  );
}
