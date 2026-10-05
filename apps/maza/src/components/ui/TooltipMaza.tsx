/**
 * TooltipMARENA — tooltip customizado para todos os gráficos Recharts.
 * bg: surface-3, border: Brasa/30, label: Fraunces, value: Brasa.
 *
 * Uso com Recharts:
 *   <Tooltip content={<TooltipMARENA />} />
 *   <Tooltip content={<TooltipMARENA labelFormatter={(v) => formatDateBR(String(v))} />} />
 */

type PayloadEntry = {
  name?: string | number;
  value?: string | number | (string | number)[];
  color?: string;
  dataKey?: string | number;
};

type Props = {
  active?: boolean;
  payload?: PayloadEntry[];
  label?: string | number;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: string | number) => string;
  /** Mapa de nome → label amigável */
  nameMap?: Record<string, string>;
};

export function TooltipMARENA({ active, payload, label, labelFormatter, valueFormatter, nameMap }: Props) {
  if (!active || !payload?.length) return null;

  const displayLabel = labelFormatter
    ? labelFormatter(String(label ?? ""))
    : String(label ?? "");

  return (
    <div
      style={{
        background: "var(--surface-3, #2C2C2A)",
        border: "1px solid rgba(196,98,45,0.25)",
        borderRadius: "var(--r-lg, 10px)",
        padding: "10px 14px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        minWidth: 140,
      }}
    >
      {displayLabel && (
        <p
          style={{
            fontFamily: "var(--font-display, Georgia, serif)",
            fontSize: "0.8125rem",
            fontWeight: 400,
            color: "var(--text, #F5F0E8)",
            margin: "0 0 8px",
            lineHeight: 1.2,
          }}
        >
          {displayLabel}
        </p>
      )}

      {payload.map((entry, i) => {
        const friendlyName = (nameMap?.[String(entry.name ?? "")] ?? String(entry.name ?? ""));
        const raw = Array.isArray(entry.value)
          ? (entry.value[0] ?? "")
          : (entry.value ?? "");
        const displayValue = valueFormatter
          ? valueFormatter(raw as string | number)
          : String(raw);

        return (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 8, marginTop: i > 0 ? 4 : 0 }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: entry.color ?? "var(--maza-brasa, #C4622D)",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "0.75rem", color: "var(--text-3, #8A8278)", flex: 1 }}>
              {friendlyName}
            </span>
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: entry.color ?? "var(--maza-brasa, #C4622D)",
              }}
            >
              {displayValue}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Cores MARENA para Recharts */
export const RECHARTS_MARENA = {
  colors: ["#C4622D", "#B8975A", "#8A8278", "#F5F0E8", "#4ADE80"],
  gridStroke: "rgba(245,240,232,0.06)",
  axisTickStyle: { fill: "#8A8278", fontSize: 11 },
  axisStyle: { stroke: "rgba(245,240,232,0.08)" },
} as const;
