"use client";

import { Plus, X } from "lucide-react";
import type { MenuItem } from "@/lib/eventos/types";

const HEADER_STYLE: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: "var(--text-3)",
  fontWeight: 600,
};

const CELL_INPUT: React.CSSProperties = {
  padding: "7px 10px",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--text)",
  fontSize: 12,
  fontFamily: "inherit",
  width: "100%",
};

/**
 * Linhas editáveis pra Menu Bar / Menu Cozinha.
 *
 * Fora dessa lista, o form mantém um textarea livre `info` (porque o HOS
 * legado armazena isso como uma row sintética com servico='_info'). Aqui
 * só lidamos com as rows reais — o caller que persiste o info separado.
 */
export function MenuSection({
  rows,
  onChange,
  categoriaOptions,
  servicoOptions,
  headerLabel,
  info,
  onInfoChange,
  infoLabel,
}: {
  rows: MenuItem[];
  onChange: (next: MenuItem[]) => void;
  categoriaOptions: ReadonlyArray<string>;
  servicoOptions: ReadonlyArray<string>;
  headerLabel: string;
  info: string;
  onInfoChange: (v: string) => void;
  infoLabel: string;
}) {
  const update = (i: number, patch: Partial<MenuItem>) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const remove = (i: number) => {
    onChange(rows.filter((_, idx) => idx !== i));
  };

  const add = () => {
    onChange([
      ...rows,
      {
        categoria: categoriaOptions[0] ?? "",
        servico: servicoOptions[0] ?? "",
        hr_ini: null,
        hr_fim: null,
        descritivo: "",
        obs: "",
      },
    ]);
  };

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "140px 140px 90px 90px 1fr 180px 36px",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={HEADER_STYLE}>{headerLabel}</div>
        <div style={HEADER_STYLE}>Serviço</div>
        <div style={HEADER_STYLE}>Hr Início</div>
        <div style={HEADER_STYLE}>Hr Fim</div>
        <div style={HEADER_STYLE}>Descritivo</div>
        <div style={HEADER_STYLE}>Observações</div>
        <div />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "140px 140px 90px 90px 1fr 180px 36px",
              gap: 8,
              alignItems: "start",
            }}
          >
            <select
              value={r.categoria}
              onChange={(e) => update(i, { categoria: e.target.value })}
              style={CELL_INPUT}
            >
              <option value="">—</option>
              {categoriaOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <select
              value={r.servico}
              onChange={(e) => update(i, { servico: e.target.value })}
              style={CELL_INPUT}
            >
              <option value="">—</option>
              {servicoOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={r.hr_ini ?? ""}
              onChange={(e) => update(i, { hr_ini: e.target.value || null })}
              style={CELL_INPUT}
            />
            <input
              type="time"
              value={r.hr_fim ?? ""}
              onChange={(e) => update(i, { hr_fim: e.target.value || null })}
              style={CELL_INPUT}
            />
            <textarea
              value={r.descritivo}
              onChange={(e) => update(i, { descritivo: e.target.value })}
              placeholder="Itens do menu..."
              rows={1}
              style={{ ...CELL_INPUT, resize: "vertical", minHeight: 34 }}
            />
            <textarea
              value={r.obs}
              onChange={(e) => update(i, { obs: e.target.value })}
              placeholder="Observações..."
              rows={1}
              style={{ ...CELL_INPUT, resize: "vertical", minHeight: 34 }}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              style={{
                background: "transparent",
                border: "1px solid var(--destructive)",
                borderRadius: 4,
                color: "var(--destructive)",
                cursor: "pointer",
                fontSize: 12,
                padding: "4px 0",
                alignSelf: "start",
              }}
              aria-label="Remover linha"
            >
              <X size={12} style={{ verticalAlign: "middle" }} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        style={{
          marginTop: 8,
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
        <Plus size={14} /> Adicionar linha
      </button>

      <div style={{ marginTop: 16 }}>
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--text-3)",
            marginBottom: 7,
          }}
        >
          {infoLabel}
        </label>
        <textarea
          value={info}
          onChange={(e) => onInfoChange(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text)",
            fontSize: 14,
            fontFamily: "inherit",
            resize: "vertical",
            minHeight: 60,
          }}
        />
      </div>
    </div>
  );
}
