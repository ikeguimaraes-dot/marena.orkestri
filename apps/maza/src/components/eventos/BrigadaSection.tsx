"use client";

import { Plus, X } from "lucide-react";
import type { BrigadaItem } from "@/lib/eventos/types";

/**
 * Edição da brigada — lista compacta de pills com função + qtd.
 * Total agregado ao final.
 */
export function BrigadaSection({
  value,
  onChange,
}: {
  value: BrigadaItem[];
  onChange: (next: BrigadaItem[]) => void;
}) {
  const total = value.reduce((s, b) => s + (b.qtd || 0), 0);

  const update = (i: number, patch: Partial<BrigadaItem>) => {
    onChange(value.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  };

  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  const add = () => {
    onChange([...value, { funcao: "", qtd: 1 }]);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px 16px",
        }}
      >
        {value.map((b, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "8px 12px",
            }}
          >
            <input
              type="text"
              placeholder="Função"
              value={b.funcao}
              onChange={(e) => update(i, { funcao: e.target.value })}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text)",
                fontSize: 13,
                width: 140,
                outline: "none",
              }}
            />
            <div style={{ width: 1, height: 20, background: "var(--border)" }} />
            <input
              type="number"
              min={0}
              value={b.qtd}
              onChange={(e) =>
                update(i, { qtd: parseInt(e.target.value, 10) || 0 })
              }
              style={{
                background: "transparent",
                border: "none",
                color: "var(--brand)",
                fontSize: 14,
                fontWeight: 700,
                width: 36,
                textAlign: "center",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-3)",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Remover"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        style={{
          marginTop: 14,
          padding: "7px 14px",
          background: "transparent",
          color: "var(--text-2)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Plus size={14} /> Adicionar função
      </button>

      <div
        style={{
          marginTop: 12,
          textAlign: "right",
          fontSize: 13,
          color: "var(--text-3)",
        }}
      >
        Total da brigada:{" "}
        <span
          style={{
            color: "var(--brand)",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {total}
        </span>
      </div>
    </div>
  );
}
