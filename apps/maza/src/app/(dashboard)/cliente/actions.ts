"use server";

// Server Actions do módulo Cliente / CRM.

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@maza/db/supabase/server";
import { requireUser } from "@maza/auth/server";
import type { ActionResult } from "@/lib/result";
import {
  clientSchema,
  clientUpdateSchema,
  interactionSchema,
  type ClientFormValues,
  type ClientUpdateValues,
  type InteractionFormValues,
} from "@/lib/cliente/schema";
import type {
  Client,
  ClientInteraction,
  ClientWithBrand,
} from "@/lib/cliente/types";

const T_CLIENTS = "clients" as const;
const T_INTER = "client_interactions" as const;

export async function listClients(
  unitId?: string | null,
): Promise<ClientWithBrand[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    let q = supabase
      .from(T_CLIENTS)
      .select("*, brand:brands(name, color), unit:units(name)")
      .order("ativo", { ascending: false })
      .order("nome", { ascending: true });
    if (unitId) q = q.eq("unit_id", unitId);

    type JoinRow = Client & {
      brand: { name: string; color: string | null } | { name: string; color: string | null }[] | null;
      unit: { name: string } | { name: string }[] | null;
    };
    const { data, error } = await q.returns<JoinRow[]>();
    if (error) {
      console.error("[listClients]", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const b = Array.isArray(r.brand) ? r.brand[0] : r.brand;
      const u = Array.isArray(r.unit) ? r.unit[0] : r.unit;
      const { brand: _b, unit: _u, ...rest } = r;
      void _b; void _u;
      return {
        ...rest,
        brand_name: b?.name ?? null,
        brand_color: b?.color ?? null,
        unit_name: u?.name ?? null,
      } as ClientWithBrand;
    });
  } catch (e) {
    console.error("[listClients] exceção:", e);
    return [];
  }
}

export async function getClient(id: string): Promise<Client | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(T_CLIENTS)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[getClient]", error.message);
      return null;
    }
    return (data as Client | null) ?? null;
  } catch (e) {
    console.error("[getClient] exceção:", e);
    return null;
  }
}

export async function createClient(
  input: ClientFormValues,
): Promise<ActionResult<Client>> {
  try {
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const payload = {
      brand_id: parsed.data.brand_id,
      unit_id: parsed.data.unit_id,
      nome: parsed.data.nome,
      email: parsed.data.email || null,
      telefone: parsed.data.telefone ?? null,
      empresa: parsed.data.empresa ?? null,
      origem: parsed.data.origem ?? null,
      observacoes: parsed.data.observacoes ?? null,
      ativo: parsed.data.ativo ?? true,
      created_by: user.id,
    };
    const { data, error } = await supabase
      .from(T_CLIENTS)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/cliente");
    return { ok: true, data: data as Client };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateClient(
  id: string,
  patch: ClientUpdateValues,
): Promise<ActionResult<Client>> {
  try {
    const parsed = clientUpdateSchema.safeParse(patch);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const payload = { ...parsed.data, email: parsed.data.email || null };
    const { data, error } = await supabase
      .from(T_CLIENTS)
      .update(payload as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/cliente");
    revalidatePath(`/cliente/${id}`);
    return { ok: true, data: data as Client };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function toggleClientAtivo(
  id: string,
): Promise<ActionResult<Client>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data: cur, error: rErr } = await supabase
      .from(T_CLIENTS)
      .select("ativo")
      .eq("id", id)
      .single();
    if (rErr || !cur) return { ok: false, error: rErr?.message ?? "Não encontrado" };
    const next = !(cur as { ativo: boolean }).ativo;
    const { data, error } = await supabase
      .from(T_CLIENTS)
      .update({ ativo: next } as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    revalidatePath("/cliente");
    revalidatePath(`/cliente/${id}`);
    return { ok: true, data: data as Client };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function listInteractions(
  clientId: string,
): Promise<ClientInteraction[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(T_INTER)
      .select("*")
      .eq("client_id", clientId)
      .order("data", { ascending: false });
    if (error) {
      console.error("[listInteractions]", error.message);
      return [];
    }
    return (data ?? []) as ClientInteraction[];
  } catch (e) {
    console.error("[listInteractions] exceção:", e);
    return [];
  }
}

export async function createInteraction(
  input: InteractionFormValues,
): Promise<ActionResult<ClientInteraction>> {
  try {
    const parsed = interactionSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    // datetime-local vem sem timezone — força ISO completa em UTC.
    const dataIso = parsed.data.data.length === 16
      ? new Date(parsed.data.data).toISOString()
      : parsed.data.data;

    const payload = {
      client_id: parsed.data.client_id,
      tipo: parsed.data.tipo,
      descricao: parsed.data.descricao ?? null,
      data: dataIso,
      created_by: user.id,
    };
    const { data, error } = await supabase
      .from(T_INTER)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath(`/cliente/${parsed.data.client_id}`);
    return { ok: true, data: data as ClientInteraction };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/**
 * Eventos vinculados ao cliente. O schema atual de `events` (008) não tem
 * client_id FK — só campos texto (contato_cliente, email_cliente, empresa_cliente).
 * Match heurístico: brand_id + email/telefone/contato. Se ficar muito ruim,
 * próxima migration adiciona events.client_id.
 */
export type LinkedEvent = {
  id: string;
  nome: string;
  data_inicio: string;
  status: string;
  valor_total: number | null;
};

export async function listEventsForClient(
  clientId: string,
): Promise<LinkedEvent[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data: cli } = await supabase
      .from(T_CLIENTS)
      .select("brand_id, nome, email, telefone, empresa")
      .eq("id", clientId)
      .maybeSingle();
    if (!cli) return [];
    const c = cli as {
      brand_id: string;
      nome: string;
      email: string | null;
      telefone: string | null;
      empresa: string | null;
    };

    // OR builder: bate em pelo menos 1 dos campos.
    const orParts: string[] = [];
    if (c.email) orParts.push(`email_cliente.eq.${c.email}`);
    if (c.telefone) orParts.push(`telefone_cliente.eq.${c.telefone}`);
    if (c.empresa) orParts.push(`empresa_cliente.eq.${c.empresa}`);
    if (c.nome) orParts.push(`contato_cliente.eq.${c.nome}`);
    if (orParts.length === 0) return [];

    const { data, error } = await supabase
      .from("events")
      .select("id, nome, data_inicio, status, valor_total")
      .eq("brand_id", c.brand_id)
      .or(orParts.join(","))
      .order("data_inicio", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[listEventsForClient]", error.message);
      return [];
    }
    return (data ?? []) as LinkedEvent[];
  } catch (e) {
    console.error("[listEventsForClient] exceção:", e);
    return [];
  }
}
