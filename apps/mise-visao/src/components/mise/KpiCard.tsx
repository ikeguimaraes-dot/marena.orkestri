export function KpiCard({
  label,
  value,
  emptyAsDash = true,
  danger = false,
  hint,
}: {
  label: string;
  value: number;
  emptyAsDash?: boolean;
  danger?: boolean;
  hint?: string;
}) {
  const showDash = emptyAsDash && value === 0;
  const isDanger = danger && !showDash && value > 0;

  return (
    <div
      style={{
        border: `1px solid ${isDanger ? "rgba(252,165,165,0.4)" : "var(--border-soft)"}`,
        borderRadius: 12,
        padding: "16px 18px",
        background: "var(--surface)",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: isDanger ? "#FCA5A5" : "var(--text)" }}>
        {showDash ? "—" : value}
      </div>
      {hint && !showDash && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
