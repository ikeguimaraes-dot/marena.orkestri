// Tipos do módulo Cardápio (engenharia de cardápio).
// Espelha tabela `menu_items` em supabase/migrations/010_financeiro.sql.
//
// NUMERIC do Postgres vem como string no JSON da API REST. Aqui usamos
// number direto (Database<T>.Row já tipa como number) — converter quando
// necessário no boundary das actions.

export type MenuItem = {
  id: string;
  brand_id: string;
  unit_id: string | null;
  nome: string;
  categoria: string;
  preco_venda: number;
  custo_total: number | null;
  cmv_pct: number | null;       // GENERATED no banco
  tem_ficha_tecnica: boolean;
  ativo: boolean;
  observacoes: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type MenuItemInsert = {
  id?: string;
  brand_id: string;
  unit_id?: string | null;
  nome: string;
  categoria: string;
  preco_venda: number;
  custo_total?: number | null;
  tem_ficha_tecnica?: boolean;
  ativo?: boolean;
  observacoes?: string | null;
  criado_por?: string | null;
};

export type MenuItemUpdate = Partial<Omit<MenuItemInsert, "brand_id">>;

export type MenuItemWithBrand = MenuItem & {
  brand_name: string | null;
  brand_color: string | null;
};

// Categorias sugeridas. Não é enum no banco — é só texto livre — mas a UI
// oferece estes como opções recorrentes.
export const CARDAPIO_CATEGORIAS_SUGERIDAS = [
  "Entrada",
  "Prato Principal",
  "Sobremesa",
  "Bebida",
  "Drink",
  "Vinho",
  "Cerveja",
  "Café",
  "Acompanhamento",
  "Outro",
] as const;

// ── Ficha técnica de cardápio (migration 025) ─────────────────

export type RecipeItem = {
  id: string;
  menu_item_id: string;
  insumo: string;
  unidade: string | null;
  quantidade: number;
  custo_unitario: number;
  custo_total: number; // GENERATED ALWAYS AS (quantidade * custo_unitario)
  ingredient_id: string | null;
  perda_pct: number | null;
  created_at: string;
};

export type RecipeItemInsert = {
  menu_item_id: string;
  insumo: string;
  unidade?: string | null;
  quantidade: number;
  custo_unitario: number;
  ingredient_id?: string | null;
  perda_pct?: number | null;
};

export type RecipeItemUpdate = Partial<Omit<RecipeItemInsert, "menu_item_id">>;

export type RecipeNote = {
  id: string;
  menu_item_id: string;
  nota: string;
  created_by: string | null;
  created_at: string;
};

// Faixas de CMV pra UI de semáforo.
export type CmvSeverity = "ok" | "atencao" | "critico" | "indefinido";

export function classifyCmv(pct: number | null | undefined): CmvSeverity {
  if (pct == null) return "indefinido";
  if (pct < 28) return "ok";
  if (pct <= 35) return "atencao";
  return "critico";
}
