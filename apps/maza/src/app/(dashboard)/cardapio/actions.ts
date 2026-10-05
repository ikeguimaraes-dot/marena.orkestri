"use server";

// Server Actions do módulo Cardápio (engenharia de cardápio / CMV).
//
// Tabela menu_items em 010_financeiro.sql. cmv_pct é GENERATED — não enviar.

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@maza/db/supabase/server";
import { requireUser } from "@maza/auth/server";
import type { ActionResult } from "@/lib/result";
import {
  cmvItemSchema,
  cmvItemUpdateSchema,
  type MenuItemFormValues,
  type MenuItemUpdateValues,
} from "@/lib/cardapio/schema";
import type {
  MenuItem,
  MenuItemWithBrand,
  RecipeItem,
  RecipeItemInsert,
  RecipeItemUpdate,
  RecipeNote,
} from "@/lib/cardapio/types";

const TABLE = "menu_items" as const;

/**
 * Lista todos os menu_items das marcas que o user tem acesso.
 * RLS já filtra por maza_has_role_for_brand. brandId opcional aplica filtro extra.
 */
export async function listMenuItems(
  brandId?: string | null,
): Promise<MenuItemWithBrand[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    let q = supabase
      .from(TABLE)
      .select("*, brand:brands(name, color)")
      .order("ativo", { ascending: false })
      .order("categoria", { ascending: true })
      .order("nome", { ascending: true });
    if (brandId) q = q.eq("brand_id", brandId);

    type JoinRow = MenuItem & {
      brand: { name: string; color: string } | { name: string; color: string }[] | null;
    };
    const { data, error } = await q.returns<JoinRow[]>();
    if (error) {
      console.error("[listMenuItems]", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const b = Array.isArray(r.brand) ? r.brand[0] : r.brand;
      const { brand: _b, ...rest } = r;
      void _b;
      return {
        ...rest,
        brand_name: b?.name ?? null,
        brand_color: b?.color ?? null,
      } as MenuItemWithBrand;
    });
  } catch (e) {
    console.error("[listMenuItems] exceção:", e);
    return [];
  }
}

export async function getMenuItem(id: string): Promise<MenuItem | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[getMenuItem]", error.message);
      return null;
    }
    return (data as MenuItem | null) ?? null;
  } catch (e) {
    console.error("[getMenuItem] exceção:", e);
    return null;
  }
}

export async function createMenuItem(
  input: MenuItemFormValues,
): Promise<ActionResult<MenuItem>> {
  try {
    const parsed = cmvItemSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const payload = {
      brand_id: parsed.data.brand_id,
      unit_id: parsed.data.unit_id ?? null,
      nome: parsed.data.nome,
      categoria: parsed.data.categoria,
      preco_venda: parsed.data.preco_venda,
      custo_total: parsed.data.custo_total ?? null,
      tem_ficha_tecnica: parsed.data.tem_ficha_tecnica ?? false,
      ativo: parsed.data.ativo ?? true,
      observacoes: parsed.data.observacoes ?? null,
    };

    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/cardapio");
    return { ok: true, data: data as MenuItem };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateMenuItem(
  id: string,
  patch: MenuItemUpdateValues,
): Promise<ActionResult<MenuItem>> {
  try {
    const parsed = cmvItemUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data, error } = await supabase
      .from(TABLE)
      .update(parsed.data as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/cardapio");
    revalidatePath(`/cardapio/${id}/editar`);
    return { ok: true, data: data as MenuItem };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function toggleMenuItemAtivo(
  id: string,
): Promise<ActionResult<MenuItem>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data: current, error: readErr } = await supabase
      .from(TABLE)
      .select("ativo")
      .eq("id", id)
      .single();
    if (readErr || !current) return { ok: false, error: readErr?.message ?? "Não encontrado" };

    const next = !(current as { ativo: boolean }).ativo;
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ativo: next } as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/cardapio");
    return { ok: true, data: data as MenuItem };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function deleteMenuItem(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/cardapio");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

// ── Ficha técnica (recipe_items / recipe_notes) ───────────────

export async function listRecipeItems(menuItemId: string): Promise<RecipeItem[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("recipe_items")
      .select("*")
      .eq("menu_item_id", menuItemId)
      .order("created_at");
    if (error) { console.error("[listRecipeItems]", error.message); return []; }
    return (data ?? []) as RecipeItem[];
  } catch (e) {
    console.error("[listRecipeItems] exceção:", e);
    return [];
  }
}

export async function upsertRecipeItem(
  payload: RecipeItemInsert & { id?: string },
): Promise<ActionResult<RecipeItem>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    if (!payload.insumo?.trim()) return { ok: false, error: "Insumo obrigatório" };

    const { id, ...rest } = payload;
    let q;
    if (id) {
      const patch: RecipeItemUpdate = {
        insumo: rest.insumo,
        unidade: rest.unidade ?? null,
        quantidade: rest.quantidade,
        custo_unitario: rest.custo_unitario,
        ingredient_id: rest.ingredient_id ?? null,
        perda_pct: rest.perda_pct ?? null,
      };
      q = supabase
        .from("recipe_items")
        .update(patch as never)
        .eq("id", id)
        .select()
        .single();
    } else {
      const insertPayload = {
        menu_item_id: rest.menu_item_id,
        insumo: rest.insumo,
        unidade: rest.unidade ?? null,
        quantidade: rest.quantidade,
        custo_unitario: rest.custo_unitario,
        ingredient_id: rest.ingredient_id ?? null,
        perda_pct: rest.perda_pct ?? null,
      };
      q = supabase
        .from("recipe_items")
        .insert(insertPayload as never)
        .select()
        .single();
    }

    const { data, error } = await q;
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath(`/cardapio/${payload.menu_item_id}`);
    revalidatePath("/cardapio");
    return { ok: true, data: data as RecipeItem };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function deleteRecipeItem(
  id: string,
  menuItemId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { error } = await supabase.from("recipe_items").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/cardapio/${menuItemId}`);
    revalidatePath("/cardapio");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listRecipeNotes(menuItemId: string): Promise<RecipeNote[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("recipe_notes")
      .select("*")
      .eq("menu_item_id", menuItemId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[listRecipeNotes]", error.message); return []; }
    return (data ?? []) as RecipeNote[];
  } catch (e) {
    console.error("[listRecipeNotes] exceção:", e);
    return [];
  }
}

export async function createRecipeNote(
  menuItemId: string,
  nota: string,
): Promise<ActionResult<RecipeNote>> {
  try {
    if (!nota?.trim()) return { ok: false, error: "Nota não pode estar vazia" };
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data, error } = await supabase
      .from("recipe_notes")
      .insert({ menu_item_id: menuItemId, nota: nota.trim(), created_by: user.id } as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath(`/cardapio/${menuItemId}`);
    return { ok: true, data: data as RecipeNote };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}
