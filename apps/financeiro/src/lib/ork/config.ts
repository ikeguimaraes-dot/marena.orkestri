export const ORK_SECTIONS = {
  inteligencia: "Inteligência",
  revisao: "Revisão de registros",
  receita: "Receita",
  despesas: "Despesas e contas a pagar",
  cartoes: "Cartões e recebimentos",
  caixa: "Caixa",
  socios: "Sócios e outras empresas",
  investimentos: "Investimentos",
  orcamento: "Orçamento",
  documentos: "Documentos fiscais",
  dre: "DRE preliminar",
  "dre-receita": "DRE · Receita",
  "dre-cmv": "DRE · CMV e insumos",
  "dre-pessoal": "DRE · Folha e pessoal",
  "dre-ocupacao": "DRE · Ocupação",
  "dre-manutencao": "DRE · Manutenção",
  "dre-marketing": "DRE · Marketing",
  "dre-administrativas": "DRE · Administrativas",
  "dre-tributos": "DRE · Tributos",
  "dre-financeiras": "DRE · Financeiras",
  "dre-outras": "DRE · Outras despesas",
  "dre-fora_dre": "DRE · Fora da DRE",
  "dre-nao_classificados": "DRE · Não classificados",
} as const;
export type OrkSection = keyof typeof ORK_SECTIONS;
export function isReconciliationUnit(unit: unknown): boolean {
  return !!(unit && typeof unit === "object" && "reconciliation_source_unit_id" in unit && unit.reconciliation_source_unit_id);
}
const operational=Object.entries(ORK_SECTIONS).filter(([key])=>!key.startsWith('dre'));
const dre=Object.entries(ORK_SECTIONS).filter(([key])=>key.startsWith('dre'));
export const orkNavGroups = [
 {id:"ork",label:"Restaurante Ork",icon:"Wallet",defaultOpen:true,habilitado:true,items:operational.map(([key,label])=>({href:`/financeiro/ork/${key}`,label,icon:key==="inteligencia"?"Search":"Sheet"}))},
 {id:"ork-dre",label:"DRE preliminar",icon:"ChartNoAxesCombined",defaultOpen:true,habilitado:true,items:dre.map(([key,label])=>({href:`/financeiro/ork/${key}`,label:key==='dre'?'Visão geral':label.replace('DRE · ',''),icon:"Sheet"}))},
];
