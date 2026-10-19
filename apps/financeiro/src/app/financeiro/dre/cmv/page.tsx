import { fetchAllPaginado as fetchAll } from "@/lib/financeiro/razao/gerar"
import Link from "next/link"
import { requireUser } from "@maza/auth/server"
import { getCurrentUnit } from "@maza/auth/unit"
import { createSupabaseServerClient } from "@maza/db/supabase/server"
import { ProdutosClient } from "@/components/financeiro/produtos/ProdutosClient"

export const dynamic = "force-dynamic"

export type NfeSearchParams = Promise<{ mes?: string; ano?: string; q?: string }>

export type ProdutoRow = {
  id: number
  unit_id: string
  chave_nfe: string | null
  fornecedor_nome: string | null
  nr_danfe: string | null
  v_total_danfe: number | null
  dt_emissao: string | null
  item_codigo: string | null
  item_descricao: string | null
  unidade_medida: string | null
  tipo_item: string | null
  q_embalagem: number | null
  q_estoque: number | null
  v_embalagem: number | null
  v_total_embalagem: number | null
  v_custo_medio: number | null
  v_custo_compra: number | null
  v_custo_total: number | null
  perc_variacao: number | null
  calcula_cmv: boolean | null
  fornecedor_codigo: string | null
  codigo_gerencial: string | null
  desc_gerencial: string | null
  mes_lancamento: number
  ano_lancamento: number
}

async function NfeProdutosPage({ searchParams, direcao }: {
  searchParams: NfeSearchParams
  direcao: "entrada" | "saida"
}) {
  await requireUser()
  const sp = await searchParams

  const now = new Date()
  const mesSolicitado = sp.mes ? parseInt(sp.mes, 10) : now.getMonth() + 1
  const anoSolicitado = sp.ano ? parseInt(sp.ano, 10) : now.getFullYear()
  const q   = sp.q?.trim() ?? ""

  const unit = await getCurrentUnit()
  const unitId = unit?.id ?? null

  const supabase = await createSupabaseServerClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uq = (qb: any) => unitId ? qb.eq("unit_id", unitId) : qb


  // Use one row per fiscal document instead of one row per item to build the
  // month selector. Spreadsheet-only rows are queried separately so legacy
  // imports remain available without making XML-heavy histories expensive.
  const documentosMesesPromise = fetchAll<{ id: number; emissao: string }>((from, to) =>
    uq(db.from("nfe_documentos")
      .select("id,emissao")
      .eq("direcao", direcao)
      .eq("cancelada", false)
      .order("id")
      .range(from, to))
  )
  const planilhaMesesPromise = direcao === "entrada"
    ? fetchAll<{ id: number; mes_lancamento: number; ano_lancamento: number }>((from, to) =>
      uq(db.from("produtos_relatorio")
        .select("id,mes_lancamento,ano_lancamento")
        .is("chave_nfe", null)
        .order("id")
        .range(from, to))
    )
    : []
  const [documentosMeses, planilhaMeses] = await Promise.all([
    documentosMesesPromise,
    planilhaMesesPromise,
  ])
  const mesesMap = new Map<string, { mes: number; ano: number }>()
  for (const row of documentosMeses) {
    const data = new Date(row.emissao)
    if (Number.isNaN(data.getTime())) continue
    const item = { mes: data.getUTCMonth() + 1, ano: data.getUTCFullYear() }
    mesesMap.set(`${item.ano}-${item.mes}`, item)
  }
  for (const row of planilhaMeses) {
    const item = { mes: Number(row.mes_lancamento), ano: Number(row.ano_lancamento) }
    mesesMap.set(`${item.ano}-${item.mes}`, item)
  }
  const meses = [...mesesMap.values()].sort((a, b) =>
    a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes
  )

  const mesDisponivel = meses.some(m => m.mes === mesSolicitado && m.ano === anoSolicitado)
  const periodo = mesDisponivel
    ? { mes: mesSolicitado, ano: anoSolicitado }
    : meses.at(-1) ?? { mes: mesSolicitado, ano: anoSolicitado }
  const { mes, ano } = periodo


  const baseProdutosQuery = () => {
    const query = uq(db.from("produtos_relatorio").select([
      "id", "unit_id", "chave_nfe", "fornecedor_nome", "nr_danfe",
      "v_total_danfe", "dt_emissao", "item_codigo", "item_descricao",
      "unidade_medida", "tipo_item", "q_embalagem", "q_estoque",
      "v_embalagem", "v_total_embalagem", "v_custo_medio", "v_custo_compra",
      "v_custo_total", "perc_variacao", "calcula_cmv", "fornecedor_codigo",
      "codigo_gerencial", "desc_gerencial", "mes_lancamento", "ano_lancamento",
    ].join(",")))
      .eq("mes_lancamento", mes)
      .eq("ano_lancamento", ano)
      .order("id")
    return direcao === "entrada"
      ? query.or("direcao_nfe.eq.entrada,direcao_nfe.is.null")
      : query.eq("direcao_nfe", "saida")
  }

  // chave_nfe IS NOT NULL = veio de XML; chave_nfe IS NULL = veio de planilha/Excel.
  const rowsPromise = fetchAll((from, to) =>
    baseProdutosQuery().not("chave_nfe", "is", null).range(from, to)
  )
  const rowsPlanilhaPromise = direcao === "entrada"
    ? fetchAll((from, to) => baseProdutosQuery().is("chave_nfe", null).range(from, to))
    : []

  // Previous month for MoM comparison
  const prevMes = mes === 1 ? 12 : mes - 1
  const prevAno = mes === 1 ? ano - 1 : ano
  const prevRowsPromise = fetchAll((from, to) => {
    let query = uq(db.from("produtos_relatorio")
      .select("id,v_custo_total,calcula_cmv,desc_gerencial"))
      .eq("mes_lancamento", prevMes)
      .eq("ano_lancamento", prevAno)
      .not("chave_nfe", "is", null)
      .order("id")
    query = direcao === "entrada"
      ? query.or("direcao_nfe.eq.entrada,direcao_nfe.is.null")
      : query.eq("direcao_nfe", "saida")
    return query.range(from, to)
  })

  // Para saída, o indicador deve usar o valor fiscal total das notas (vNF).
  // Somar itens pode divergir por impostos/frete e antes ainda era truncado.
  const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01T00:00:00.000Z`
  const proximoMes = new Date(Date.UTC(ano, mes, 1)).toISOString()
  // Seleciona os dias da unidade/mês e soma os pagamentos efetivamente recebidos.
  const receitasPromise = direcao === "entrada" && unitId
    ? fetchAll<{ id: string }>((from, to) =>
      db.from("receita_dias").select("id")
        .eq("unit_id", unitId)
        .gte("data", inicioMes.slice(0, 10)).lt("data", proximoMes.slice(0, 10))
        .order("id").range(from, to))
    : []
  const documentosPromise = fetchAll<{ valor_total: number | null }>((from, to) => uq(db.from("nfe_documentos")
    .select("id,valor_total")
    .eq("direcao", direcao)
    .eq("cancelada", false)
    .gte("emissao", inicioMes)
    .lt("emissao", proximoMes)
    .order("id")
    .range(from, to)))
  const [rows, rowsPlanilha, prevRows, receitas, documentos] = await Promise.all([
    rowsPromise, rowsPlanilhaPromise, prevRowsPromise, receitasPromise, documentosPromise,
  ])
  const pagamentos: { valor_recebido: number | null }[] = []
  for (let i = 0; i < receitas.length; i += 100) {
    pagamentos.push(...await fetchAll<{ valor_recebido: number | null }>((from, to) =>
      db.from("receita_pagamentos").select("workday_id_fk,forma,valor_recebido")
        .in("workday_id_fk", receitas.slice(i, i + 100).map(row => row.id))
        .order("workday_id_fk").order("forma").range(from, to)))
  }
  const recebido = pagamentos.length > 0
    ? pagamentos.reduce((sum, row) => sum + Math.round(Number(row.valor_recebido ?? 0) * 100), 0) / 100
    : null
  const totalDocumentos = documentos.reduce(
    (sum, row) => sum + Number(row.valor_total ?? 0), 0
  )


  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <Link
        href="/financeiro/dre"
        style={{
          fontSize: 11, color: "var(--text-3)", textDecoration: "none",
          fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase",
        }}
      >
        ← Financeiro
      </Link>

      <ProdutosClient
        rows={(rows ?? []) as ProdutoRow[]}
        rowsPlanilha={(rowsPlanilha ?? []) as ProdutoRow[]}
        prevRows={(prevRows ?? []) as Pick<ProdutoRow, "id" | "v_custo_total" | "calcula_cmv" | "desc_gerencial">[]}
        mes={mes}
        ano={ano}
        meses={meses}
        unitId={unitId}
        q={q}
        direcao={direcao}
        totalDocumentos={totalDocumentos}
        recebido={recebido}
      />
    </div>
  )
}

export default function ProdutosPage({ searchParams }: { searchParams: NfeSearchParams }) {
  return <NfeProdutosPage searchParams={searchParams} direcao="entrada" />
}
