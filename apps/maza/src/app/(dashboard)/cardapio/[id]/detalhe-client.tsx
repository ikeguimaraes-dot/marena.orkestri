"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChefHat,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@maza/ui/button";
import { Input } from "@maza/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@maza/ui/table";
import { formatBRL } from "@/lib/format";
import { classifyCmv, type CmvSeverity } from "@/lib/cardapio/types";
import type { MenuItem, RecipeItem, RecipeNote } from "@/lib/cardapio/types";
import {
  upsertRecipeItem,
  createRecipeNote,
} from "@/app/(dashboard)/cardapio/actions";
import { removeRecipeItemExtended } from "@/lib/compras/recipe-actions";
import { searchIngredientsForRecipe } from "@/lib/compras/ingredient-actions";
import type { Ingredient } from "@maza/db/types/compras-ingredientes";

// ── constants ─────────────────────────────────────────────────

const UNIDADES = ["", "kg", "g", "l", "ml", "un", "cx", "fardo", "duzia"] as const;

// ── helpers ──────────────────────────────────────────────────

const SEVERITY_STYLE: Record<CmvSeverity, { fg: string; bg: string; label: string }> = {
  ok: { fg: "#15803D", bg: "rgba(34,197,94,0.16)", label: "OK" },
  atencao: { fg: "#A16207", bg: "rgba(245,158,11,0.16)", label: "Atenção" },
  critico: { fg: "#B91C1C", bg: "rgba(239,68,68,0.16)", label: "Crítico" },
  indefinido: { fg: "var(--text-3)", bg: "var(--surface-2)", label: "—" },
};

function CmvBadge({ pct }: { pct: number | null }) {
  const sev = classifyCmv(pct);
  const s = SEVERITY_STYLE[sev];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 99,
        fontSize: 13,
        fontWeight: 700,
        background: s.bg,
        color: s.fg,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {pct == null ? "—" : `${pct.toFixed(1)}%`}
    </span>
  );
}

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

// ── Row state ─────────────────────────────────────────────────

type RowDraft = {
  id?: string;
  insumo: string;
  unidade: string;
  quantidade: string;
  perda_pct: string;
  custo_unitario: string;
};

function emptyDraft(): RowDraft {
  return { insumo: "", unidade: "", quantidade: "", perda_pct: "", custo_unitario: "" };
}

function rowFromItem(r: RecipeItem): RowDraft {
  return {
    id: r.id,
    insumo: r.insumo,
    unidade: r.unidade ?? "",
    quantidade: String(r.quantidade),
    perda_pct: r.perda_pct != null && Number(r.perda_pct) > 0 ? String(Number(r.perda_pct)) : "",
    custo_unitario: String(r.custo_unitario),
  };
}

// ── Ingredient autocomplete ───────────────────────────────────

function IngredientSearch({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (ing: Ingredient) => void;
}) {
  const [suggestions, setSuggestions] = useState<Ingredient[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(val: string) {
    onChange(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.trim().length >= 2) {
      timerRef.current = setTimeout(async () => {
        const results = await searchIngredientsForRecipe(val);
        setSuggestions(results);
        setOpen(results.length > 0);
      }, 220);
    } else {
      setSuggestions([]);
      setOpen(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        placeholder="Ingrediente ou insumo*"
        style={{ height: 30, fontSize: 12 }}
        autoFocus
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {suggestions.map((ing) => (
            <button
              key={ing.id}
              type="button"
              onMouseDown={() => { onSelect(ing); setOpen(false); }}
              style={{
                display: "flex",
                width: "100%",
                textAlign: "left",
                padding: "7px 12px",
                fontSize: 12,
                color: "var(--text)",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
                gap: 8,
                alignItems: "baseline",
              }}
            >
              <span style={{ fontWeight: 600 }}>{ing.nome}</span>
              <span style={{ color: "var(--text-3)", fontSize: 11 }}>
                {ing.unidade_padrao} · {formatBRL(Number(ing.custo_padrao))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── EditRow ───────────────────────────────────────────────────

function EditRow({
  draft,
  initialIngredientId = null,
  menuItemId,
  onSave,
  onCancel,
}: {
  draft: RowDraft;
  initialIngredientId?: string | null;
  menuItemId: string;
  onSave: (saved: RecipeItem) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<RowDraft>(draft);
  // useRef so the ingredient UUID survives re-renders without triggering them.
  // useState was being reset when setD caused a re-render that remounted EditRow.
  const selectedIngredientIdRef = useRef<string | null>(initialIngredientId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const qtd = parseFloat(String(d.quantidade).replace(",", ".")) || 0;
  const custo = parseFloat(String(d.custo_unitario).replace(",", ".")) || 0;
  const preview = qtd * custo;

  function set<K extends keyof RowDraft>(key: K, value: RowDraft[K]) {
    setD((p) => ({ ...p, [key]: value }));
    setErr(null);
  }

  function handleSelectIngredient(ing: Ingredient) {
    selectedIngredientIdRef.current = ing.id;
    setD((p) => ({
      ...p,
      insumo: ing.nome,
      custo_unitario: String(ing.custo_padrao),
      unidade: ing.unidade_padrao,
    }));
    setErr(null);
  }

  function handleInsumoChange(value: string) {
    selectedIngredientIdRef.current = null;
    setD((p) => ({ ...p, insumo: value }));
  }

  async function save() {
    if (!d.insumo.trim()) { setErr("Insumo obrigatório"); return; }
    setSaving(true);
    try {
      const r = await upsertRecipeItem({
        id: d.id,
        menu_item_id: menuItemId,
        ingredient_id: selectedIngredientIdRef.current,
        insumo: d.insumo.trim(),
        unidade: d.unidade || null,
        quantidade: qtd,
        perda_pct: d.perda_pct ? parseFloat(String(d.perda_pct).replace(",", ".")) : null,
        custo_unitario: custo,
      });
      if (!r.ok) { setErr(r.error); return; }
      onSave(r.data);
    } finally {
      setSaving(false);
    }
  }

  const numInput = (
    key: "quantidade" | "custo_unitario" | "perda_pct",
    placeholder: string,
    width?: number,
    suffix?: string,
  ) => (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Input
        value={d[key] as string}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }}
        style={{
          height: 30,
          fontSize: 12,
          textAlign: "right",
          width: width ?? undefined,
          fontVariantNumeric: "tabular-nums",
        }}
      />
      {suffix && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{suffix}</span>}
    </div>
  );

  return (
    <>
      <TableRow style={{ background: "rgba(99,102,241,0.06)" }}>
        <TableCell>
          <IngredientSearch
            value={d.insumo}
            onChange={handleInsumoChange}
            onSelect={handleSelectIngredient}
          />
        </TableCell>
        <TableCell>
          <select
            value={d.unidade}
            onChange={(e) => set("unidade", e.target.value)}
            style={{
              height: 30,
              fontSize: 12,
              padding: "0 6px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text)",
              width: 80,
            }}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>{u === "" ? "—" : u}</option>
            ))}
          </select>
        </TableCell>
        <TableCell style={{ textAlign: "right" }}>{numInput("quantidade", "0", 80)}</TableCell>
        <TableCell style={{ textAlign: "right" }}>{numInput("perda_pct", "0", 70, "%")}</TableCell>
        <TableCell style={{ textAlign: "right" }}>{numInput("custo_unitario", "0,0000", 100)}</TableCell>
        <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12, color: "var(--text-2)" }}>
          {preview > 0 ? formatBRL(preview) : "—"}
        </TableCell>
        <TableCell style={{ textAlign: "right" }}>
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
            <Button type="button" size="icon" variant="ghost" style={{ width: 28, height: 28 }} onClick={onCancel} disabled={saving}>
              <X size={14} />
            </Button>
            <Button
              type="button"
              size="icon"
              style={{ width: 28, height: 28 }}
              disabled={saving}
              onClick={save}
            >
              {saving ? "…" : <Check size={14} />}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {err && (
        <TableRow style={{ background: "rgba(239,68,68,0.06)" }}>
          <TableCell colSpan={7} style={{ padding: "6px 12px", fontSize: 11, color: "#B91C1C" }}>
            {err}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────

export function DetalheFichaClient({
  item,
  initialItems,
  initialNotes,
}: {
  item: MenuItem;
  initialItems: RecipeItem[];
  initialNotes: RecipeNote[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [rows, setRows] = useState<RecipeItem[]>(initialItems);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [notes, setNotes] = useState<RecipeNote[]>(initialNotes);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const custoTotal = rows.reduce((s, r) => s + (r.custo_total ?? 0), 0);
  const cmvPct =
    item.preco_venda > 0 ? Math.round((custoTotal / item.preco_venda) * 10000) / 100 : null;

  function handleRowSaved(saved: RecipeItem) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setEditingId(null);
    startTransition(() => router.refresh());
  }

  function handleDelete(id: string) {
    if (!window.confirm("Remover este insumo?")) return;
    startTransition(async () => {
      const r = await removeRecipeItemExtended(id, item.id);
      if (!r.ok) { window.alert(`Falha: ${r.error}`); return; }
      setRows((prev) => prev.filter((x) => x.id !== id));
      router.refresh();
    });
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    const r = await createRecipeNote(item.id, newNote);
    setAddingNote(false);
    if (!r.ok) { window.alert(`Falha: ${r.error}`); return; }
    setNotes((prev) => [r.data, ...prev]);
    setNewNote("");
    startTransition(() => router.refresh());
  }

  return (
    <div style={{ maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24 }}>
        <button
          onClick={() => router.push("/cardapio")}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text-2)",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0 }}>
              {item.nome}
            </h1>
            <CmvBadge pct={cmvPct} />
            <a
              href={`/cardapio/${item.id}/editar`}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-3)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Pencil size={11} />
              Editar item
            </a>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>{item.categoria}</span>
            <span>Preço de venda: {formatBRL(item.preco_venda)}</span>
            <span>
              Custo total:{" "}
              <strong style={{ color: "var(--text-2)" }}>{formatBRL(custoTotal)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Ficha técnica */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            <ChefHat size={15} />
            Ficha Técnica
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditingId("new")}
            disabled={editingId !== null}
            style={{ height: 30, fontSize: 12, gap: 6 }}
          >
            <Plus size={13} />
            Insumo
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead style={{ textAlign: "right" }}>Qtd</TableHead>
              <TableHead style={{ textAlign: "right" }}>Perda%</TableHead>
              <TableHead style={{ textAlign: "right" }}>Custo unit.</TableHead>
              <TableHead style={{ textAlign: "right" }}>Custo total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) =>
              editingId === r.id ? (
                <EditRow
                  key={r.id}
                  draft={rowFromItem(r)}
                  initialIngredientId={r.ingredient_id}
                  menuItemId={item.id}
                  onSave={handleRowSaved}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <TableRow key={r.id} style={{ opacity: editingId !== null ? 0.5 : 1 }}>
                  <TableCell style={{ fontSize: 13, fontWeight: 500 }}>{r.insumo}</TableCell>
                  <TableCell style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {r.unidade ?? "—"}
                  </TableCell>
                  <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
                    {fmtNum(r.quantidade)}
                  </TableCell>
                  <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12, color: "var(--text-3)" }}>
                    {Number(r.perda_pct) > 0 ? `${Number(r.perda_pct).toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12, color: "var(--text-2)" }}>
                    {formatBRL(r.custo_unitario)}
                  </TableCell>
                  <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12, fontWeight: 600 }}>
                    {formatBRL(r.custo_total)}
                  </TableCell>
                  <TableCell style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 2,
                        justifyContent: "flex-end",
                        opacity: editingId !== null ? 0 : 1,
                        pointerEvents: editingId !== null ? "none" : "auto",
                      }}
                    >
                      <button
                        title="Editar"
                        onClick={() => setEditingId(r.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-3)",
                          padding: "4px 6px",
                          borderRadius: 6,
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        title="Remover"
                        onClick={() => handleDelete(r.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-3)",
                          padding: "4px 6px",
                          borderRadius: 6,
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ),
            )}

            {editingId === "new" && (
              <EditRow
                draft={emptyDraft()}
                menuItemId={item.id}
                onSave={handleRowSaved}
                onCancel={() => setEditingId(null)}
              />
            )}

            {rows.length === 0 && editingId === null && (
              <TableRow>
                <TableCell colSpan={7} style={{ textAlign: "center", padding: "32px 16px" }}>
                  <div style={{ fontSize: 13, color: "var(--text-3)" }}>
                    Nenhum insumo cadastrado. Adicione o primeiro.
                  </div>
                </TableCell>
              </TableRow>
            )}

            {rows.length > 0 && (
              <TableRow style={{ background: "var(--surface-2)", fontWeight: 700 }}>
                <TableCell
                  colSpan={5}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  Total
                </TableCell>
                <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 700 }}>
                  {formatBRL(custoTotal)}
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Notes */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text)",
          }}
        >
          <MessageSquare size={15} />
          Anotações técnicas
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Input
              placeholder="Adicionar anotação técnica…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleAddNote(); }}
              style={{ fontSize: 13 }}
            />
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={addingNote || !newNote.trim()}
              style={{ flexShrink: 0, height: 36, gap: 6 }}
            >
              <Plus size={13} />
              Adicionar
            </Button>
          </div>

          {notes.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "16px 0" }}>
              Sem anotações ainda.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: "10px 14px",
                    background: "var(--surface-2)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 13, color: "var(--text)" }}>{n.nota}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                    {new Date(n.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
