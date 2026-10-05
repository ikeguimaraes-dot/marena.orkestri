"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@maza/ui/button";
import { Input } from "@maza/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@maza/ui/select";
import { Textarea } from "@maza/ui/textarea";
import {
  createMenuItem,
  updateMenuItem,
} from "@/app/(dashboard)/cardapio/actions";
import {
  CARDAPIO_CATEGORIAS_SUGERIDAS,
  classifyCmv,
  type MenuItem,
} from "@/lib/cardapio/types";
import type { BrandOption } from "@/lib/eventos/types";
import Link from "next/link";

type Props = {
  mode: "create" | "edit";
  brands: BrandOption[];
  initial?: MenuItem;
};

const SEVERITY_FG = {
  ok: "#15803D",
  atencao: "#A16207",
  critico: "#B91C1C",
  indefinido: "var(--text-3)",
} as const;

export function CardapioFormClient({ mode, brands, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [brandId, setBrandId] = useState<string>(
    initial?.brand_id ?? brands[0]?.id ?? "",
  );
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [categoria, setCategoria] = useState(initial?.categoria ?? "");
  const [precoVenda, setPrecoVenda] = useState<string>(
    initial?.preco_venda != null ? String(initial.preco_venda) : "",
  );
  const [custoTotal, setCustoTotal] = useState<string>(
    initial?.custo_total != null ? String(initial.custo_total) : "",
  );
  const [temFicha, setTemFicha] = useState<boolean>(initial?.tem_ficha_tecnica ?? false);
  const [ativo, setAtivo] = useState<boolean>(initial?.ativo ?? true);
  const [observacoes, setObservacoes] = useState<string>(initial?.observacoes ?? "");

  // Preview do CMV em tempo real.
  const cmvPreview = useMemo(() => {
    const p = Number(precoVenda);
    const c = Number(custoTotal);
    if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0 || c < 0) return null;
    return Math.round((c / p) * 10000) / 100;
  }, [precoVenda, custoTotal]);
  const sev = classifyCmv(cmvPreview);

  const canSubmit =
    !pending &&
    brandId.length > 0 &&
    nome.trim().length > 0 &&
    categoria.trim().length > 0 &&
    Number(precoVenda) > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    const precoNum = Number(precoVenda);
    const custoNum = custoTotal === "" ? null : Number(custoTotal);

    startTransition(async () => {
      if (mode === "create") {
        const r = await createMenuItem({
          brand_id: brandId,
          nome: nome.trim(),
          categoria: categoria.trim(),
          preco_venda: precoNum,
          custo_total: custoNum,
          tem_ficha_tecnica: temFicha,
          ativo,
          observacoes: observacoes.trim() || null,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        router.push("/cardapio");
        router.refresh();
      } else {
        if (!initial) return;
        const r = await updateMenuItem(initial.id, {
          nome: nome.trim(),
          categoria: categoria.trim(),
          preco_venda: precoNum,
          custo_total: custoNum,
          tem_ficha_tecnica: temFicha,
          ativo,
          observacoes: observacoes.trim() || null,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        router.push("/cardapio");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link
        href="/cardapio"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-3)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        Cardápio
      </Link>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: 0,
            color: "var(--text)",
            letterSpacing: -0.3,
          }}
        >
          {mode === "create" ? "Novo item" : "Editar item"}
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 0" }}>
          O CMV é calculado automaticamente a partir de preço × custo.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
            marginTop: 18,
          }}
        >
          <Field label="Marca" required>
            <Select value={brandId} onValueChange={(v) => v && setBrandId(v)}>
              <SelectTrigger>
                <SelectValue>
                  {brands.find((b) => b.id === brandId)?.name ?? "Selecione marca"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Categoria" required>
            <CategoriaInput value={categoria} onChange={setCategoria} />
          </Field>

          <Field label="Nome do item" required wide>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Risoto de funghi"
            />
          </Field>

          <Field label="Preço de venda (R$)" required>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={precoVenda}
              onChange={(e) => setPrecoVenda(e.target.value)}
              placeholder="0,00"
            />
          </Field>

          <Field label="Custo total (R$)">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={custoTotal}
              onChange={(e) => setCustoTotal(e.target.value)}
              placeholder="0,00"
            />
          </Field>

          <Field label="Preview CMV" wide>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span style={{ color: SEVERITY_FG[sev] }}>
                {cmvPreview == null ? "—" : `${cmvPreview}%`}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}>
                {sev === "ok"
                  ? "Saudável (< 28%)"
                  : sev === "atencao"
                  ? "Atenção (28–35%)"
                  : sev === "critico"
                  ? "Crítico (> 35%)"
                  : "Informe preço e custo pra calcular"}
              </span>
            </div>
          </Field>

          <Field label="Tem ficha técnica?">
            <Toggle value={temFicha} onChange={setTemFicha} labels={["Sim", "Não"]} />
          </Field>

          <Field label="Item ativo">
            <Toggle value={ativo} onChange={setAtivo} labels={["Ativo", "Inativo"]} />
          </Field>

          <Field label="Observações" wide>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Anotações de receita, fornecedor, etc."
            />
          </Field>
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.30)",
              borderRadius: 8,
              fontSize: 12,
              color: "#B91C1C",
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Link
          href="/cardapio"
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
        <Button type="submit" disabled={!canSubmit}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Criar item" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  required,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        gridColumn: wide ? "1 / -1" : "auto",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
        {required && <span style={{ color: "var(--destructive)" }}> *</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  value,
  onChange,
  labels,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  labels: [string, string];
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: value ? "rgba(34,197,94,0.12)" : "var(--surface-2)",
        border: `1px solid ${value ? "rgba(34,197,94,0.40)" : "var(--border)"}`,
        borderRadius: 8,
        color: value ? "#15803D" : "var(--text-2)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all var(--t)",
        width: "fit-content",
      }}
      aria-pressed={value}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          background: value ? "#22C55E" : "var(--text-3)",
        }}
      />
      {value ? labels[0] : labels[1]}
    </button>
  );
}

function CategoriaInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list="cardapio-categorias"
        placeholder="Ex: Prato Principal"
      />
      <datalist id="cardapio-categorias">
        {CARDAPIO_CATEGORIAS_SUGERIDAS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
