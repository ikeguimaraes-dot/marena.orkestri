"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Section colapsável reusada nas seções do form de O.S.
 * Default expanded; click no head togglela.
 */
export function CollapsibleSection({
  icon,
  title,
  defaultOpen = true,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "14px 20px",
          background: "var(--surface-2)",
          borderBottom: open ? "1px solid var(--border)" : "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          color: "var(--text)",
          textAlign: "left",
          border: "none",
        }}
      >
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        <ChevronDown
          size={16}
          style={{
            color: "var(--text-3)",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>
      {open && <div style={{ padding: 20 }}>{children}</div>}
    </div>
  );
}
