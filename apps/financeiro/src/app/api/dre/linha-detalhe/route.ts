import { indicadoresReceita, type DiaIndicador, type PagamentoIndicador } from "@/lib/dre/receita-indicadores";
import { fetchAllPaginado } from "@/lib/financeiro/razao/gerar";
import { contasOperacionais, type TituloOperacional, type FolhaOperacional } from "@/lib/dre/regras-operacionais";
import { getServiceClient, jsonOk, jsonError, corsOptions, resolveEmpresa } from "@/lib/dre/api";
import { agregarItensNfeDespesa, type ItemNfeDespesa } from "@/lib/dre/nfe-despesas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function OPTIONS() {
  return corsOptions();
}

// GET /api/dre/linha-detalhe?linha=<linha>&unidade=&ano=
// Breakdown por conta gerencial DENTRO de uma linha da DRE, mês a mês, aplicando
// a precedência override do título > mapa da conta. Inclui as contas esperadas
// (esperada_mensal) mesmo sem lançamento, para a tela sinalizar faltantes.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const linha = searchParams.get("linha");
    if (!linha) return jsonError("param 'linha' é obrigatório", 400);
    const empresa = resolveEmpresa(searchParams.get("unidade") ?? searchParams.get("empresa"));
    const ano = Number(searchParams.get("ano")) || new Date().getFullYear();

    const supabase = await getServiceClient();
    const unitId = searchParams.get("unidade");
    const linhasComNfe = ["Ocupação", "Utilidades", "Operação", "Manutenção", "Marketing", "Administrativo"];
    const carregarDespesasNfe = async () => {
      if (!unitId || !/^[0-9a-f-]{36}$/i.test(unitId)) return [];
      const [itens, documentos] = await Promise.all([
        fetchAllPaginado<ItemNfeDespesa>((from, to) => supabase.from("produtos_relatorio")
          .select("id,chave_nfe,item_descricao,fornecedor_nome,tipo_item,v_custo_total,v_total_embalagem,ano_lancamento,mes_lancamento")
          .eq("unit_id", unitId).eq("direcao_nfe", "entrada").eq("ano_lancamento", ano).not("chave_nfe", "is", null).order("id").range(from, to)),
        fetchAllPaginado<{ chave: string }>((from, to) => supabase.from("nfe_documentos")
          .select("id,chave").eq("unit_id", unitId).eq("direcao", "entrada").eq("cancelada", false)
          .gte("emissao", `${ano}-01-01T00:00:00-03:00`).lt("emissao", `${ano + 1}-01-01T00:00:00-03:00`).order("id").range(from, to)),
      ]);
      return agregarItensNfeDespesa(itens, new Set(documentos.map((d) => d.chave)), ano);
    };
    if (["Marketing", "Taxas Cartão"].includes(linha)) {
      if (!unitId || !/^[0-9a-f-]{36}$/i.test(unitId)) return jsonError("Selecione uma unidade válida", 400);
      const [dias, ultimo, despesasNfe] = await Promise.all([
        fetchAllPaginado<DiaIndicador>((from,to) => supabase.from("receita_dias").select("id,data,desconto").eq("unit_id",unitId).gte("data",`${ano}-01-01`).lt("data",`${ano+1}-01-01`).order("id").range(from,to)),
        supabase.from("receita_dias").select("data").eq("unit_id",unitId).order("data",{ascending:false}).limit(1),
        linha === "Marketing" ? carregarDespesasNfe() : Promise.resolve([]),
      ]);
      if (ultimo.error) throw new Error(ultimo.error.message);
      const pagamentos: PagamentoIndicador[] = [];
      if (linha !== "Marketing") for (let i=0; i<dias.length; i+=100) {
        pagamentos.push(...await fetchAllPaginado<PagamentoIndicador>((from,to) => supabase.from("receita_pagamentos").select("workday_id_fk,forma,valor_recebido").in("workday_id_fk",dias.slice(i,i+100).map(d=>d.id)).order("workday_id_fk").order("forma").range(from,to)));
      }
      const indicadores = indicadoresReceita(dias,pagamentos);
      const meses = Array.from({length:12},(_,i)=>`${ano}-${String(i+1).padStart(2,"0")}-01`);
      const mesesValores = linha === "Marketing" ? indicadores.descontos : indicadores.taxas;
      const contas = [{conta:linha === "Marketing" ? "Influencers — descontos da Receita" : "Taxa de cartão — 3% do recebido",esperada_mensal:false,meses:mesesValores,total:Object.values(mesesValores).reduce((s,v)=>s+v,0)},
        ...despesasNfe.filter((c) => c.linha === linha).map((c) => ({ conta: c.conta, esperada_mensal: false, meses: c.meses, total: c.total }))];
      return jsonOk({linha,ano,empresa:unitId,meses,contas,esperadas:[],total:contas.reduce((s,c)=>s+c.total,0),meses_com_dados:[...new Set(dias.map(d=>`${d.data.slice(0,7)}-01`))].sort(),ultimo_mes_unidade:ultimo.data?.[0]?.data?`${ultimo.data[0].data.slice(0,7)}-01`:null,
        observacao:linha === "Marketing" ? "Inclui descontos registrados na Receita e despesas identificadas nos itens das NF-e de entrada. Itens sem correspondência inequívoca no plano de contas não são classificados automaticamente." : "Estimativa gerencial: 3% sobre todo o recebido, inclusive formas de pagamento que não são cartão.",
        pendente:false, base_recebido:indicadores.recebido});
    }
    if ([...linhasComNfe, "Impostos", "Despesas Financeiras"].includes(linha)) {
      if (!unitId || !/^[0-9a-f-]{36}$/i.test(unitId)) return jsonError("Selecione uma unidade válida", 400);
      const [titulos, folha, despesasNfe] = await Promise.all([
        fetchAllPaginado<TituloOperacional>((from, to) => supabase.from("titulos_a_pagar")
          .select("id,descricao_c_gerencial,v_titulo,d_competencia,d_lancamento,d_vencimento,ref_mes,liquidacao_origem")
          .eq("unit_id", unitId).eq("origem", "contas_pagar").order("id").range(from, to)),
        linha === "Administrativo" ? fetchAllPaginado<FolhaOperacional>((from, to) => supabase.from("folha_empresa")
          .select("id,competencia,etapa,nome,pagamento,bonificacao").eq("unit_id", unitId)
          .eq("nome_chave", "CINTIA OLIVEIRA DE CARVALHO").order("id").range(from, to)) : Promise.resolve([]),
        linhasComNfe.includes(linha) ? carregarDespesasNfe() : Promise.resolve([]),
      ]);
      const datas = [...titulos.map(t => t.d_competencia ?? t.ref_mes ?? t.d_lancamento ?? t.d_vencimento), ...folha.map(f => `${f.competencia}-01`)].filter((d): d is string => !!d).map(d => `${d.slice(0,7)}-01`).sort();
      const contas = contasOperacionais(linha, titulos.filter(t => (t.d_competencia ?? t.ref_mes ?? t.d_lancamento ?? t.d_vencimento)?.startsWith(`${ano}-`)), folha.filter(f => f.competencia.startsWith(`${ano}-`)));
      for (const contaNfe of despesasNfe.filter((c) => c.linha === linha)) {
        const existente = contas.find((c) => c.conta === contaNfe.conta);
        if (existente) {
          for (const [mes, valor] of Object.entries(contaNfe.meses)) existente.meses[mes] = Math.round(((existente.meses[mes] ?? 0) + valor) * 100) / 100;
          existente.total = Math.round((existente.total + contaNfe.total) * 100) / 100;
        } else contas.push({ conta: contaNfe.conta, esperada_mensal: false, meses: contaNfe.meses, total: contaNfe.total });
      }
      const fontePlanilha = ["Impostos", "Despesas Financeiras"].includes(linha);
      const mesesNfe = despesasNfe.flatMap((c) => Object.keys(c.meses));
      return jsonOk({ fonte_planilha: fontePlanilha, observacao: fontePlanilha ? "Valores informados na planilha de gastos, separados por unidade e competência. Não há estimativa por alíquota. O lançamento de um valor não confirma sua quitação; marcadores como ** permanecem sem confirmação de pagamento." : linhasComNfe.includes(linha) ? "Valores classificados a partir dos itens das NF-e de entrada e, quando disponíveis, das demais fontes já conciliadas. Itens ambíguos ou sem correspondência no plano de contas não são incluídos automaticamente." : undefined, linha, ano, empresa: unitId, meses: Array.from({length:12}, (_,i) => `${ano}-${String(i+1).padStart(2,"0")}-01`), contas, esperadas: [], total: contas.reduce((s,c)=>s+c.total,0), meses_com_dados: [...new Set([...datas.filter(d=>d.startsWith(`${ano}-`)), ...mesesNfe])].sort(), ultimo_mes_unidade: [...datas, ...mesesNfe].sort().at(-1) ?? null });
    }
    let q = supabase
      .from("titulos_a_pagar")
      .select("id, descricao_c_gerencial, v_titulo, ref_mes, empresa")
      .gte("ref_mes", `${ano}-01-01`).lte("ref_mes", `${ano}-12-31`);
    if (empresa) q = q.eq("empresa", empresa);

    // Último mês com dados da unidade (qualquer linha, qualquer ano) — para a
    // tela escolher um mês inicial que não esteja vazio.
    let ultQ = supabase.from("titulos_a_pagar").select("ref_mes").order("ref_mes", { ascending: false }).limit(1);
    if (empresa) ultQ = ultQ.eq("empresa", empresa);

    const [titRes, mapaRes, ovRes, ultRes] = await Promise.all([
      q,
      supabase.from("mapa_conta_dre").select("descricao_c_gerencial, linha_dre, esperada_mensal"),
      supabase.from("titulo_override").select("titulo_id, linha_dre_corrigida"),
      ultQ,
    ]);
    if (titRes.error) return jsonError(`titulos_a_pagar: ${titRes.error.message}`);
    if (mapaRes.error) return jsonError(`mapa_conta_dre: ${mapaRes.error.message}`);
    if (ovRes.error) return jsonError(`titulo_override: ${ovRes.error.message}`);

    const mapaLinha = new Map<string, string | null>();
    const mapaEsperada = new Map<string, boolean>();
    for (const m of mapaRes.data ?? []) {
      mapaLinha.set(m.descricao_c_gerencial, m.linha_dre ?? null);
      mapaEsperada.set(m.descricao_c_gerencial, !!m.esperada_mensal);
    }
    const override = new Map<string, string | null>();
    for (const o of ovRes.data ?? []) override.set(o.titulo_id, o.linha_dre_corrigida ?? null);

    type Conta = { conta: string; esperada_mensal: boolean; meses: Record<string, number>; total: number };
    const contas = new Map<string, Conta>();

    for (const t of titRes.data ?? []) {
      const desc = t.descricao_c_gerencial ?? "(sem conta)";
      const eff = (override.has(t.id as string) ? override.get(t.id as string) : mapaLinha.get(desc)) ?? null;
      if (eff !== linha) continue;
      const v = Number(t.v_titulo ?? 0); // positivo = despesa
      const mes = (t.ref_mes as string | null) ?? null;
      const c: Conta = contas.get(desc) ?? { conta: desc, esperada_mensal: !!mapaEsperada.get(desc), meses: {}, total: 0 };
      if (mes) c.meses[mes] = (c.meses[mes] ?? 0) + v;
      c.total += v;
      contas.set(desc, c);
    }

    // Contas esperadas desta linha — incluir mesmo sem lançamento (faltantes).
    const esperadas: string[] = [];
    for (const [desc, esp] of mapaEsperada) {
      if (esp && mapaLinha.get(desc) === linha) {
        esperadas.push(desc);
        if (!contas.has(desc)) contas.set(desc, { conta: desc, esperada_mensal: true, meses: {}, total: 0 });
      }
    }

    const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}-01`);
    const lista = Array.from(contas.values()).sort((a, b) => b.total - a.total);
    const total = lista.reduce((s, c) => s + c.total, 0);

    // Meses (deste ano) que têm QUALQUER título da unidade — para o mês inicial.
    const meses_com_dados = Array.from(new Set((titRes.data ?? []).map((t) => t.ref_mes).filter(Boolean) as string[])).sort();
    const ultimo_mes_unidade = (ultRes.data?.[0]?.ref_mes as string | null) ?? null;

    return jsonOk({ linha, ano, empresa: empresa ?? null, meses, contas: lista, esperadas, total, meses_com_dados, ultimo_mes_unidade });
  } catch (e) {
    return jsonError(String(e));
  }
}
