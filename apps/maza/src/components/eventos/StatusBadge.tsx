import { STATUS_COLORS, STATUS_LABEL } from "@/lib/eventos/labels";
import type { EventStatus } from "@maza/db/types/database";

export function StatusBadge({ status }: { status: EventStatus }) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABEL[status] ?? status;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        background: color?.bg ?? "var(--surface-2)",
        color: color?.fg ?? "var(--text-3)",
        border: `1px solid ${color?.border ?? "var(--border)"}`,
      }}
    >
      {label}
    </span>
  );
}
