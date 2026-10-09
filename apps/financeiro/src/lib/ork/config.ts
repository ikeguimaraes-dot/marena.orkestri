export const ORK_SECTIONS = {
  inteligencia: "Inteligência",
  receita: "Receita",
  despesas: "Despesas e contas a pagar",
  cartoes: "Cartões e recebimentos",
  caixa: "Caixa",
  socios: "Sócios e outras empresas",
  investimentos: "Investimentos",
  orcamento: "Orçamento",
  documentos: "Documentos fiscais",
} as const;
export type OrkSection = keyof typeof ORK_SECTIONS;
export function isReconciliationUnit(unit: unknown): boolean {
  return !!(unit && typeof unit === "object" && "reconciliation_source_unit_id" in unit && unit.reconciliation_source_unit_id);
}
export const orkNavGroups = [{ id: "ork", label: "Restaurante Ork", icon: "Wallet", defaultOpen: true, habilitado: true,
  items: Object.entries(ORK_SECTIONS).map(([key,label]) => ({ href: `/financeiro/ork/${key}`, label, icon: key === "inteligencia" ? "Search" : "Sheet" })),
}];
