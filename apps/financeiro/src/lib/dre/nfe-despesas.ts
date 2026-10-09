import { normalizarConta } from "./regras-operacionais";

export type ItemNfeDespesa = {
  chave_nfe: string | null;
  item_descricao: string | null;
  fornecedor_nome: string | null;
  tipo_item: string | null;
  v_custo_total: number | null;
  v_total_embalagem: number | null;
  ano_lancamento: number | null;
  mes_lancamento: number | null;
};

export type ClassificacaoNfeDespesa = {
  linha: "Utilidades" | "Manutenção" | "Operação" | "Administrativo" | "Marketing" | "Ocupação";
  conta: string;
};

const contem = (texto: string, termos: string[]) => termos.some((termo) => texto.includes(termo));

/**
 * Classifica somente itens com evidência fiscal direta e aderência inequívoca ao
 * plano de contas entregue pela operação. Alimentos e bebidas ficam no CMV;
 * imobilizado e descrições ambíguas permanecem sem classificação.
 */
export function classificarItemNfeDespesa(item: Pick<ItemNfeDespesa, "item_descricao" | "fornecedor_nome" | "tipo_item">): ClassificacaoNfeDespesa | null {
  const descricao = normalizarConta(item.item_descricao ?? "");
  const fornecedor = normalizarConta(item.fornecedor_nome ?? "");
  const ncm = (item.tipo_item ?? "").replace(/\D/g, "");
  const texto = `${descricao} ${fornecedor}`;

  if (ncm === "27111910" && contem(descricao, ["GLP", "P-13", "P13", "GAS LIQUEFEITO"])) {
    return { linha: "Utilidades", conta: "Gás Encanado" };
  }

  if (contem(texto, ["CONSTRULUZ", "TINTAS MC", "CAPITAL REFRIG", "FRIGGA LOJA"]) ||
      contem(descricao, ["COMP ELGIN", "GAS REFRIGERANTE", "FILTRO SECADOR", "GRELHA FORNO", "LONA EM PVC (ANTIMICROBIAL)"])) {
    return { linha: "Manutenção", conta: "Manutenção e Conservação" };
  }

  if (contem(descricao, ["PLANTAS ORNAMENTAIS", "PAISAGISMO"])) {
    return { linha: "Manutenção", conta: "Decoração e Paisagismo" };
  }

  if (contem(descricao, [
    "DETERGENTE", "DESINFETANTE", "DESINCRUSTANTE", "SABONETE", "ALCOOL 70", "PANO MULTI", "SACO ALVEJADO",
    "PAPEL HIGIEN", "TOALHA INT", "TOALHA DE PAPEL", "ESPONJA", "FIBRA FIBRACO", "VASSOURA", "PURIFICADOR",
    "SACO PRETO LIXO", "SACO AZUL LIXO", "NEUTER SUPER", "PRO HA 3000", "X-10 - BRANCO",
  ])) {
    return { linha: "Operação", conta: "Material de Limpeza" };
  }

  if (contem(descricao, [
    "SACO PLAST.P/VACUO", "SACO VACUO", "BOBINA PICOTADA", "BOBINA ACOUGUE", "FILME PVC", "PAPEL ALUMINIO",
    "MARMITEX", "COPO 200ML", "COLHER SOBRE CRISTAL", "PALITO BAMBU", "SACO MANGA CONF", "GUARDANAPO",
    "TOUCA TNT", "ETIQUETA 6X6CM",
  ])) {
    return { linha: "Operação", conta: "Embalagens" };
  }

  if (contem(descricao, [
    "PRATO ", "PRATO FUNDO", "PRATO DE PAO", "BAIXELAS", "TIGELA", "TRAVESSA", "TALHER", "FACA CHEF",
    "FACA INOX", "CARRETILHA INOX", "MACARICO MULTIUSO", "MAQUINA PARA MASSA",
  ]) || ["69120000", "69111010", "69111090", "82159910"].includes(ncm)) {
    return { linha: "Operação", conta: "Utensílios" };
  }

  if (contem(descricao, ["COMANDA DE MESA", "TONER ", "CARTUCHO IMPRESS", "PAPEL A4", "CANETA ", "GRAMPEADOR"])) {
    return { linha: "Administrativo", conta: "Material de Escritório" };
  }

  if (contem(descricao, ["PROPAGANDA", "PUBLICIDADE", "PATROCINIO", "INFLUENCER", "MIDIA SOCIAL", "IMPULSIONAMENTO"])) {
    return { linha: "Marketing", conta: contem(descricao, ["INFLUENCER"]) ? "Influencer" : "Propaganda, Publicidade e Patrocínio" };
  }

  return null;
}

export function agregarItensNfeDespesa(itens: ItemNfeDespesa[], chavesValidas: Set<string>, ano: number) {
  const contas = new Map<string, { linha: string; conta: string; meses: Record<string, number>; total: number }>();
  for (const item of itens) {
    if (!item.chave_nfe || !chavesValidas.has(item.chave_nfe) || item.ano_lancamento !== ano || !item.mes_lancamento) continue;
    const classificacao = classificarItemNfeDespesa(item);
    if (!classificacao) continue;
    const valor = Math.abs(Number(item.v_custo_total ?? item.v_total_embalagem ?? 0));
    if (!Number.isFinite(valor) || valor === 0) continue;
    const chave = `${classificacao.linha}\u0000${classificacao.conta}`;
    const conta = contas.get(chave) ?? { ...classificacao, meses: {}, total: 0 };
    const mes = `${ano}-${String(item.mes_lancamento).padStart(2, "0")}-01`;
    conta.meses[mes] = Math.round(((conta.meses[mes] ?? 0) + valor) * 100) / 100;
    conta.total = Math.round((conta.total + valor) * 100) / 100;
    contas.set(chave, conta);
  }
  return [...contas.values()];
}
