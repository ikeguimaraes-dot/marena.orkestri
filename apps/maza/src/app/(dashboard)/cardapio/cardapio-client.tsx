"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChefHat,
  Download,
  FileWarning,
  MoreHorizontal,
  Pencil,
  Power,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Utensils,
  X,
} from "lucide-react";

import { Button, buttonVariants } from "@maza/ui/button";
import { Input } from "@maza/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@maza/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@maza/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@maza/ui/table";
import { formatBRL } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import {
  deleteMenuItem,
  toggleMenuItemAtivo,
} from "@/app/(dashboard)/cardapio/actions";
import type { MenuItemWithBrand } from "@/lib/cardapio/types";
import { classifyCmv } from "@/lib/cardapio/types";
import type { BrandOption } from "@/lib/eventos/types";

const SEVERITY_STYLE = {
  ok: { fg: "#15803D", bg: "rgba(34,197,94,0.16)", label: "OK" },
  atencao: { fg: "#A16207", bg: "rgba(245,158,11,0.16)", label: "Atenção" },
  critico: { fg: "#B91C1C", bg: "rgba(239,68,68,0.16)", label: "Crítico" },
  indefinido: { fg: "var(--text-3)", bg: "var(--surface-2)", label: "—" },
} as const;

function CmvBadge({ pct }: { pct: number | null }) {
  const sev = classifyCmv(pct);
  const style = SEVERITY_STYLE[sev];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
        background: style.bg,
        color: style.fg,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {pct == null ? "—" : `${pct}%`}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "warn" | "danger";
  icon?: React.ReactNode;
}) {
  const fg =
    tone === "danger" ? "#B91C1C" : tone === "warn" ? "#A16207" : "var(--text)";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: "var(--text-3)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: fg,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{hint}</div>
      )}
    </div>
  );
}

export function CardapioClient({
  items,
  brands,
}: {
  items: MenuItemWithBrand[];
  brands: BrandOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ativos" | "inativos" | "todos">(
    "ativos",
  );
  const [categoriaFilter, setCategoriaFilter] = useState<string>("__all__");
  const [brandFilter, setBrandFilter] = useState<string>("__all__");

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.categoria) set.add(it.categoria);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter === "ativos" && !it.ativo) return false;
      if (statusFilter === "inativos" && it.ativo) return false;
      if (categoriaFilter !== "__all__" && it.categoria !== categoriaFilter) return false;
      if (brandFilter !== "__all__" && it.brand_id !== brandFilter) return false;
      if (q) {
        const hay = `${it.nome} ${it.categoria} ${it.brand_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter, categoriaFilter, brandFilter]);

  // Resumo (sobre items ativos do filtro brand atual; ignora outros filtros).
  const resumo = useMemo(() => {
    const base = items.filter((it) => {
      if (!it.ativo) return false;
      if (brandFilter !== "__all__" && it.brand_id !== brandFilter) return false;
      return true;
    });
    const total = base.length;
    const semFicha = base.filter((it) => !it.tem_ficha_tecnica).length;
    const cmvNumeros = base
      .map((it) => it.cmv_pct)
      .filter((p): p is number => p != null);
    const cmvMedio =
      cmvNumeros.length > 0
        ? Math.round(
            (cmvNumeros.reduce((a, b) => a + b, 0) / cmvNumeros.length) * 100,
          ) / 100
        : null;
    const criticos = base.filter(
      (it) => it.cmv_pct != null && it.cmv_pct > 35,
    ).length;
    return { total, semFicha, cmvMedio, criticos };
  }, [items, brandFilter]);

  // Agrupa por categoria pra render.
  const grouped = useMemo(() => {
    const map = new Map<string, MenuItemWithBrand[]>();
    for (const it of filtered) {
      const arr = map.get(it.categoria) ?? [];
      arr.push(it);
      map.set(it.categoria, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleMenuItemAtivo(id);
      router.refresh();
    });
  }

  function handleDelete(id: string, nome: string) {
    if (!window.confirm(`Excluir o item "${nome}"? Essa ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      const r = await deleteMenuItem(id);
      if (!r.ok) window.alert(`Falha ao excluir: ${r.error}`);
      router.refresh();
    });
  }

  return (
    <>
      {/* Resumo */}
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 18,
        }}
      >
        <SummaryCard
          label="Total de itens"
          value={resumo.total}
          icon={<Utensils size={12} />}
          hint="Apenas ativos"
        />
        <SummaryCard
          label="Sem ficha técnica"
          value={resumo.semFicha}
          icon={<FileWarning size={12} />}
          tone={resumo.semFicha > 0 ? "warn" : "neutral"}
          hint={resumo.semFicha > 0 ? "Padronize as receitas" : "Tudo padronizado"}
        />
        <SummaryCard
          label="CMV médio"
          value={resumo.cmvMedio == null ? "—" : `${resumo.cmvMedio}%`}
          icon={
            resumo.cmvMedio != null && resumo.cmvMedio < 28 ? (
              <TrendingDown size={12} />
            ) : (
              <TrendingUp size={12} />
            )
          }
          tone={
            resumo.cmvMedio == null
              ? "neutral"
              : resumo.cmvMedio > 35
              ? "danger"
              : resumo.cmvMedio >= 28
              ? "warn"
              : "neutral"
          }
          hint="Média ponderada simples"
        />
        <SummaryCard
          label="Itens críticos"
          value={resumo.criticos}
          icon={<AlertTriangle size={12} />}
          tone={resumo.criticos > 0 ? "danger" : "neutral"}
          hint="CMV acima de 35%"
        />
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-3)",
              pointerEvents: "none",
            }}
          />
          <Input
            placeholder="Buscar nome, categoria, marca…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>

        {brands.length > 1 && (
          <Select value={brandFilter} onValueChange={(v) => setBrandFilter(v ?? "__all__")}>
            <SelectTrigger style={{ minWidth: 160 }}>
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas marcas</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={categoriaFilter}
          onValueChange={(v) => setCategoriaFilter(v ?? "__all__")}
        >
          <SelectTrigger style={{ minWidth: 160 }}>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger style={{ minWidth: 130 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          style={{ height: 36, gap: 6, whiteSpace: "nowrap" }}
          onClick={() => {
            const rows = filtered.map((it) => [
              it.nome,
              it.categoria,
              it.brand_name ?? "",
              it.preco_venda,
              it.custo_total ?? "",
              it.cmv_pct != null ? it.cmv_pct : "",
              it.tem_ficha_tecnica ? "Sim" : "Não",
              it.ativo ? "Ativo" : "Inativo",
            ]);
            downloadCsv(
              `cardapio-cmv-${new Date().toISOString().slice(0, 10)}.csv`,
              ["Nome", "Categoria", "Marca", "Preço Venda", "Custo Total", "CMV%", "Ficha Técnica", "Status"],
              rows,
            );
          }}
        >
          <Download size={13} />
          CSV
        </Button>
      </div>

      {/* Tabela agrupada por categoria */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {grouped.length === 0 ? (
          <div
            style={{
              padding: "56px 20px",
              textAlign: "center",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
          >
            <Utensils
              size={32}
              style={{ color: "var(--text-3)", marginBottom: 8 }}
            />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              Nenhum item encontrado
            </div>
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0 14px" }}>
              {items.length === 0
                ? "Cadastre o primeiro item do cardápio pra começar."
                : "Nenhum resultado pros filtros atuais."}
            </p>
            {items.length === 0 && (
              <Link href="/cardapio/novo" className={buttonVariants()}>
                Novo item
              </Link>
            )}
          </div>
        ) : (
          grouped.map(([cat, rows]) => (
            <section key={cat}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                  letterSpacing: 0.8,
                  margin: "0 4px 8px",
                }}
              >
                {cat} · {rows.length}
              </div>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "var(--surface)",
                  overflow: "hidden",
                }}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead style={{ textAlign: "right" }}>Preço</TableHead>
                      <TableHead style={{ textAlign: "right" }}>Custo</TableHead>
                      <TableHead style={{ textAlign: "center" }}>CMV%</TableHead>
                      <TableHead style={{ textAlign: "center" }}>Ficha</TableHead>
                      <TableHead style={{ textAlign: "center" }}>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((it) => (
                      <TableRow
                        key={it.id}
                        onClick={() => router.push(`/cardapio/${it.id}`)}
                        style={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--text)",
                            }}
                          >
                            {it.nome}
                          </div>
                          {it.observacoes && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-3)",
                                marginTop: 2,
                                maxWidth: 360,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {it.observacoes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            fontSize: 12,
                            color: "var(--text)",
                          }}
                        >
                          {formatBRL(it.preco_venda)}
                        </TableCell>
                        <TableCell
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            fontSize: 12,
                            color: it.custo_total == null ? "var(--text-3)" : "var(--text-2)",
                          }}
                        >
                          {it.custo_total == null ? "—" : formatBRL(it.custo_total)}
                        </TableCell>
                        <TableCell style={{ textAlign: "center" }}>
                          <CmvBadge pct={it.cmv_pct} />
                        </TableCell>
                        <TableCell
                          style={{ textAlign: "center" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/cardapio/${it.id}`);
                          }}
                          title="Ver ficha técnica"
                        >
                          {it.tem_ficha_tecnica ? (
                            <Check
                              size={16}
                              style={{ color: "#15803D", display: "inline" }}
                            />
                          ) : (
                            <X
                              size={16}
                              style={{ color: "var(--text-3)", display: "inline" }}
                            />
                          )}
                        </TableCell>
                        <TableCell style={{ textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: 99,
                              background: it.ativo
                                ? "rgba(34,197,94,0.12)"
                                : "var(--surface-2)",
                              color: it.ativo ? "#22C55E" : "var(--text-3)",
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 99,
                                background: it.ativo ? "#22C55E" : "var(--text-3)",
                              }}
                            />
                            {it.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </TableCell>
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                          style={{ textAlign: "right" }}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className={buttonVariants({
                                variant: "ghost",
                                size: "icon",
                              })}
                              aria-label="Ações"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/cardapio/${it.id}`)}
                              >
                                <ChefHat className="mr-2 h-4 w-4" />
                                Ficha técnica
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/cardapio/${it.id}/editar`)
                                }
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggle(it.id)}>
                                <Power className="mr-2 h-4 w-4" />
                                {it.ativo ? "Desativar" : "Ativar"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(it.id, it.nome)}
                                style={{ color: "var(--destructive)" }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
