"use client"

import { useState, useMemo } from "react"
import type { TopProdutoItem } from "@/app/financeiro/actions"
import { formatBRL } from "@/lib/financeiro/utils"

type SortKey = "total" | "qtd"
type Period = "mes" | "dia"

type Props = { produtosMes: TopProdutoItem[]; produtosDia: TopProdutoItem[]; dataSelecionada: string | null }

export function TopProdutosTable({ produtosMes, produtosDia, dataSelecionada }: Props) {
  const [period, setPeriod] = useState<Period>("mes")
  const [sort, setSort] = useState<SortKey>("total")
  const [query, setQuery] = useState("")
  const produtos = period === "mes" ? produtosMes : produtosDia
  const dateLabel = dataSelecionada
    ? new Date(`${dataSelecionada}T12:00:00`).toLocaleDateString("pt-BR")
    : "dia selecionado"

  const sorted = useMemo(
    () => [...produtos]
      .filter((p) => p.produto.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")))
      .sort((a, b) => b[sort] - a[sort])
      .slice(0, 60),
    [produtos, query, sort],
  )

  if (!produtosMes.length) {
    return (
      <div
        style={{
          padding: "28px 18px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--text-3)",
          background: "var(--surface)",
          border: "1px dashed var(--border)",
          borderRadius: 12,
        }}
      >
        Sem dados de vendas de produtos para o mês atual.
      </div>
    )
  }

  return (
    <div>
      {/* Controles */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {/* Período */}
        <div style={{ display: "flex", gap: 6 }}>
          {(["mes", "dia"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              style={{
                padding: "5px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: period === value ? "var(--brand)" : "var(--surface)",
                color: period === value ? "#fff" : "var(--text-2)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: 0.3,
              }}
            >
              {value === "mes" ? "Mês inteiro" : `Dia ${dateLabel}`}
            </button>
          ))}
        </div>

        {/* Sort toggle */}
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <span style={{ fontSize: 11, color: "var(--text-3)", alignSelf: "center" }}>
            Ordenar:
          </span>
          {([
            ["total", "Faturamento"],
            ["qtd", "Quantidade"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              style={{
                padding: "5px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: sort === key ? "var(--text)" : "var(--surface)",
                color: sort === key ? "var(--bg, #fff)" : "var(--text-2)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: 0.3,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <input
        aria-label="Buscar produto no ranking"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar produto vendido…"
        style={{ width: "100%", boxSizing: "border-box", marginBottom: 12, padding: "8px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12 }}
      />
      <p style={{ margin: "0 0 10px", fontSize: 11, color: "var(--text-3)" }}>
        Top {sorted.length} por {sort === "total" ? "faturamento" : "quantidade vendida"} · {period === "mes" ? "mês inteiro" : dateLabel}
      </p>
      {sorted.length ? <FlatTable produtos={sorted} sort={sort} /> : (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", border: "1px dashed var(--border)", borderRadius: 12 }}>Nenhum produto encontrado neste período.</div>
      )}
    </div>
  )
}

function FlatTable({ produtos, sort }: { produtos: TopProdutoItem[]; sort: SortKey }) {
  return (
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
          display: "grid",
          gridTemplateColumns: "32px 1fr 80px 110px",
          gap: 12,
          padding: "8px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        <span>#</span>
        <span>Produto</span>
        <span style={{ textAlign: "right", color: sort === "qtd" ? "var(--brand)" : undefined }}>Qtd</span>
        <span style={{ textAlign: "right", color: sort === "total" ? "var(--brand)" : undefined }}>Faturamento</span>
      </div>
      {produtos.map((p, i) => (
        <div
          key={`${p.grupo}::${p.produto}`}
          style={{
            display: "grid",
            gridTemplateColumns: "32px 1fr 80px 110px",
            gap: 12,
            padding: "10px 16px",
            borderTop: i === 0 ? "none" : "1px solid var(--border)",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>
            {i + 1}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.produto}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: sort === "qtd" ? 700 : 400,
              color: sort === "qtd" ? "var(--text)" : "var(--text-2)",
              textAlign: "right",
            }}
          >
            {fmtQtd(p.qtd)}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: sort === "total" ? 700 : 500,
              color: "var(--text)",
              textAlign: "right",
            }}
          >
            {formatBRL(p.total)}
          </span>
        </div>
      ))}
    </div>
  )
}

function fmtQtd(n: number): string {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)
}
