"use server";

// Server Actions do módulo Eventos.
//
// Padrão Marena: ActionResult<T> + cookie SSR (createSupabaseServerClient)
// + RLS via maza_has_role_for_brand. Insert/update fazem `as never` cast
// porque Database<T> infere `never` em PostgREST v12.

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@maza/db/supabase/server";
import { requireUser } from "@maza/auth/server";
import type { ActionResult } from "@/lib/result";
import { eventFormSchema, type EventFormValues } from "@/lib/eventos/schema";
import type {
  BrandOption,
  EventDetailData,
  EventFull,
  EventListRow,
  EventStatusLogEntry,
  UnitOption,
} from "@/lib/eventos/types";
import type { EventStatus } from "@maza/db/types/database";

const EVENTS = "events" as const;
const STATUS_LOG = "event_status_log" as const;

// ── Helpers ───────────────────────────────────────────────────

/**
 * Combina date "YYYY-MM-DD" + time "HH:MM" em ISO timestamptz local.
 * Sem hora → meio-dia local pra evitar TZ flip.
 */
function combineDateTime(date: string, time: string | null | undefined): string {
  const t = time && /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : "12:00:00";
  return `${date}T${t}-03:00`;
}

/** Converte payload do form pro shape de insert/update da tabela events. */
function buildEventPayload(input: EventFormValues, groupId: string) {
  return {
    group_id: groupId,
    brand_id: input.brand_id,
    unit_id: input.unit_id ?? null,
    nome: input.nome,
    tipo: input.tipo || null,
    tema: input.tema || null,
    data_inicio: combineDateTime(input.data_inicio, input.hora_inicio),
    data_fim: input.hora_termino
      ? combineDateTime(input.data_inicio, input.hora_termino)
      : null,
    hora_inicio: input.hora_inicio || null,
    hora_termino: input.hora_termino || null,
    num_convidados: input.num_convidados ?? null,
    contato_cliente: input.contato_cliente || null,
    situacao_pagamento: input.situacao_pagamento || null,
    responsavel_comercial: input.responsavel_comercial || null,
    responsavel_operacional: input.responsavel_operacional || null,
    status: input.status as EventStatus,
    briefing_cliente: input.briefing_cliente || null,
    brigada: input.brigada,
    menu_bar: input.menu_bar,
    menu_cozinha: input.menu_cozinha,
    campo_livre: input.campo_livre || null,
    montagem: input.montagem || null,
    montagem_descricao: input.montagem_descricao || null,
    tempos_movimentos: input.tempos_movimentos || null,
    espacos: input.espacos || null,
    acesso_entrada: input.acesso_entrada || null,
    acesso_obs: input.acesso_obs || null,
    mobiliario: input.mobiliario || null,
    mobiliario_obs: input.mobiliario_obs || null,
    fotografia: input.fotografia || null,
    valet: input.valet || null,
    artistico: input.artistico || null,
    gerador: input.gerador || null,
    ambulancia: input.ambulancia || null,
    menores: input.menores || null,
    layout_anexos: input.layout_anexos.length ? input.layout_anexos : null,
  };
}

type BrandJoinRow = {
  brand: { name: string; color: string; group_id: string | null } | null;
  unit: { name: string } | null;
};

function unwrapJoin<T>(j: T | T[] | null): T | null {
  if (!j) return null;
  return Array.isArray(j) ? (j[0] ?? null) : j;
}

// ── Listagem + filtros ────────────────────────────────────────

export type ListEventFilters = {
  brand_id?: string | null;
  status?: EventStatus | null;
  search?: string | null;
};

export async function listEvents(
  filters: ListEventFilters = {},
): Promise<EventListRow[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    let q = supabase
      .from(EVENTS)
      .select(
        "*, brand:brands!inner(name, color, group_id), unit:units(name)",
      )
      .order("data_inicio", { ascending: false });

    if (filters.brand_id) q = q.eq("brand_id", filters.brand_id);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.search) q = q.ilike("nome", `%${filters.search}%`);

    const { data, error } = await q.returns<(EventFull & BrandJoinRow)[]>();
    if (error) {
      console.error("[listEvents]", error.message);
      return [];
    }
    return (data ?? []).map((row) => {
      const brand = unwrapJoin(row.brand);
      const unit = unwrapJoin(row.unit);
      return {
        ...row,
        brand_name: brand?.name ?? null,
        brand_color: brand?.color ?? null,
        unit_name: unit?.name ?? null,
      } as EventListRow;
    });
  } catch (e) {
    console.error("[listEvents] exceção:", e);
    return [];
  }
}

export async function getEventDetail(
  id: string,
): Promise<EventDetailData | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const { data: ev, error: evErr } = await supabase
      .from(EVENTS)
      .select("*, brand:brands!inner(name, color, group_id), unit:units(name)")
      .eq("id", id)
      .maybeSingle<EventFull & BrandJoinRow>();
    if (evErr || !ev) {
      if (evErr) console.error("[getEventDetail]", evErr.message);
      return null;
    }

    const brand = unwrapJoin(ev.brand);
    const unit = unwrapJoin(ev.unit);
    const event: EventListRow = {
      ...ev,
      brand_name: brand?.name ?? null,
      brand_color: brand?.color ?? null,
      unit_name: unit?.name ?? null,
    };

    const { data: log } = await supabase
      .from(STATUS_LOG)
      .select("id, status_anterior, status_novo, motivo, changed_by, created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .returns<EventStatusLogEntry[]>();

    return { event, status_log: log ?? [] };
  } catch (e) {
    console.error("[getEventDetail] exceção:", e);
    return null;
  }
}

// ── Brands acessíveis (RLS já filtra) ─────────────────────────

export async function listAccessibleBrands(): Promise<BrandOption[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, slug, color, group_id")
      .eq("active", true)
      .order("name")
      .returns<BrandOption[]>();
    if (error) {
      console.error("[listAccessibleBrands]", error.message);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.error("[listAccessibleBrands] exceção:", e);
    return [];
  }
}

export async function listUnitsForBrand(
  brandId: string,
): Promise<UnitOption[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("units")
      .select("id, name, brand_id")
      .eq("brand_id", brandId)
      .eq("active", true)
      .order("name")
      .returns<UnitOption[]>();
    if (error) {
      console.error("[listUnitsForBrand]", error.message);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.error("[listUnitsForBrand] exceção:", e);
    return [];
  }
}

// ── Create / Update ──────────────────────────────────────────

export async function createEvent(
  input: EventFormValues,
): Promise<ActionResult<EventFull>> {
  try {
    const parsed = eventFormSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    // Resolve group_id pela brand selecionada
    const { data: brand, error: brErr } = await supabase
      .from("brands")
      .select("group_id")
      .eq("id", parsed.data.brand_id)
      .maybeSingle<{ group_id: string | null }>();
    if (brErr || !brand?.group_id) {
      return {
        ok: false,
        error: brErr?.message ?? "Marca sem group_id — config inconsistente",
      };
    }

    const payload = {
      ...buildEventPayload(parsed.data, brand.group_id),
      created_by: user.id,
      criado_por_nome: user.email?.split("@")[0] ?? null,
    };

    const { data, error } = await supabase
      .from(EVENTS)
      .insert(payload as never)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao criar evento" };
    }

    revalidatePath("/eventos");
    return { ok: true, data: data as EventFull };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

export async function updateEvent(
  id: string,
  input: EventFormValues,
): Promise<ActionResult<EventFull>> {
  try {
    const parsed = eventFormSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados inválidos",
      };
    }
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data: brand, error: brErr } = await supabase
      .from("brands")
      .select("group_id")
      .eq("id", parsed.data.brand_id)
      .maybeSingle<{ group_id: string | null }>();
    if (brErr || !brand?.group_id) {
      return {
        ok: false,
        error: brErr?.message ?? "Marca sem group_id",
      };
    }

    const payload = {
      ...buildEventPayload(parsed.data, brand.group_id),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(EVENTS)
      .update(payload as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar" };
    }

    revalidatePath("/eventos");
    revalidatePath(`/eventos/${id}`);
    return { ok: true, data: data as EventFull };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

// ── Status transitions (com log) ─────────────────────────────

export async function updateEventStatus(
  id: string,
  novo: EventStatus,
  motivo?: string | null,
): Promise<ActionResult<EventFull>> {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    // Pega status atual pra logar transição
    const { data: current } = await supabase
      .from(EVENTS)
      .select("status")
      .eq("id", id)
      .maybeSingle<{ status: EventStatus }>();

    const update: Record<string, unknown> = {
      status: novo,
      updated_at: new Date().toISOString(),
    };
    if (novo === "aprovado" || novo === "confirmado") {
      update.approved_by = user.id;
      update.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from(EVENTS)
      .update(update as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar status" };
    }

    // Log (best-effort)
    if (current && current.status !== novo) {
      await supabase.from(STATUS_LOG).insert({
        event_id: id,
        status_anterior: current.status,
        status_novo: novo,
        motivo: motivo ?? null,
        changed_by: user.id,
      } as never);
    }

    revalidatePath("/eventos");
    revalidatePath(`/eventos/${id}`);
    return { ok: true, data: data as EventFull };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

export async function deleteEvent(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { error } = await supabase.from(EVENTS).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/eventos");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

// ── Stats pra dashboard cards ────────────────────────────────

export type EventStats = {
  total: number;
  rascunhos: number;
  confirmados: number;
  realizados: number;
};

export async function getEventStats(): Promise<EventStats> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { total: 0, rascunhos: 0, confirmados: 0, realizados: 0 };
    const { data } = await supabase
      .from(EVENTS)
      .select("status")
      .returns<{ status: EventStatus }[]>();
    const rows = data ?? [];
    return {
      total: rows.length,
      rascunhos: rows.filter((r) => r.status === "rascunho").length,
      confirmados: rows.filter(
        (r) => r.status === "confirmado" || r.status === "aprovado",
      ).length,
      realizados: rows.filter(
        (r) => r.status === "realizado" || r.status === "concluido",
      ).length,
    };
  } catch (e) {
    console.error("[getEventStats] exceção:", e);
    return { total: 0, rascunhos: 0, confirmados: 0, realizados: 0 };
  }
}
