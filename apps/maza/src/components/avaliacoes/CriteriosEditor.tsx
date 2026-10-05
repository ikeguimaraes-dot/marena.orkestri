"use client";

// Editor dinâmico de critérios pra performance_templates.
// Usado em novo/edit template. Não tem state próprio — totalmente controlado.

import { GripVertical, Plus, Trash2 } from "lucide-react";

import { Input } from "@maza/ui/input";
import { Textarea } from "@maza/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@maza/ui/select";
import {
  CRITERIO_TIPO_LABEL,
  type PerformanceCriterio,
  type PerformanceCriterioTipo,
} from "@/lib/avaliacoes/types";

const TIPO_VALUES: PerformanceCriterioTipo[] = ["nota_1_5", "sim_nao", "texto"];

function newId() {
  return (
    "c_" +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  );
}

export function CriteriosEditor({
  criterios,
  onChange,
}: {
  criterios: PerformanceCriterio[];
  onChange: (next: PerformanceCriterio[]) => void;
}) {
  function patch(idx: number, p: Partial<PerformanceCriterio>) {
    const next = [...criterios];
    const cur = next[idx];
    if (!cur) return;
    next[idx] = { ...cur, ...p };
    onChange(next);
  }
  function remove(idx: number) {
    const next = criterios.filter((_, i) => i !== idx);
    onChange(next);
  }
  function add() {
    const next: PerformanceCriterio = {
      id: newId(),
      nome: "",
      descricao: "",
      peso: 1,
      tipo: "nota_1_5",
    };
    onChange([...criterios, next]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {criterios.length === 0 && (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            background: "var(--surface-2)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-3)",
          }}
        >
          Nenhum critério ainda. Adicione abaixo.
        </div>
      )}

      {criterios.map((c, idx) => (
        <div
          key={c.id}
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr 120px 140px auto",
            gap: 8,
            alignItems: "start",
            padding: 10,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 36,
              color: "var(--text-3)",
              cursor: "grab",
            }}
            title={`Critério ${idx + 1}`}
          >
            <GripVertical size={14} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Input
              placeholder="Nome do critério"
              value={c.nome}
              onChange={(e) => patch(idx, { nome: e.target.value })}
            />
            <Textarea
              rows={2}
              placeholder="Descrição (opcional)"
              value={c.descricao ?? ""}
              onChange={(e) => patch(idx, { descricao: e.target.value })}
              style={{ fontSize: 12 }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 10,
                color: "var(--text-3)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
                fontWeight: 600,
              }}
            >
              Peso
            </span>
            <Input
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={c.peso}
              onChange={(e) => {
                const n = Number(e.target.value);
                patch(idx, { peso: Number.isFinite(n) ? n : 1 });
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 10,
                color: "var(--text-3)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
                fontWeight: 600,
              }}
            >
              Tipo
            </span>
            <Select
              value={c.tipo}
              onValueChange={(v) =>
                v && patch(idx, { tipo: v as PerformanceCriterioTipo })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_VALUES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CRITERIO_TIPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            type="button"
            onClick={() => remove(idx)}
            title="Remover critério"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 36,
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "#B91C1C",
              cursor: "pointer",
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "10px",
          background: "var(--surface-2)",
          border: "1px dashed var(--border)",
          borderRadius: 8,
          color: "var(--text-2)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <Plus size={14} />
        Adicionar critério
      </button>
    </div>
  );
}
