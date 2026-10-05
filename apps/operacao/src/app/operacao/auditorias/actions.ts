"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import type { ActionResult } from "@/lib/result";
import type { QualityChecklistRow, ChecklistRecordRow } from "@kph/db/types/database";

export async function listChecklists(
  unitId: string,
  apenasAtivos = true,
): Promise<QualityChecklistRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  let q = supabase
    .from("quality_checklists" as never)
    .select("*")
    .eq("unit_id", unitId)
    .order("area")
    .order("turno");
  if (apenasAtivos) q = q.eq("ativo", true);
  const { data, error } = (await q) as unknown as {
    data: QualityChecklistRow[] | null;
    error: { message: string } | null;
  };
  if (error) {
    console.error("[listChecklists]", error.message);
    return [];
  }
  return data ?? [];
}

export async function listChecklistRecords(
  unitId: string,
  dias = 30,
): Promise<ChecklistRecordRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const { data, error } = (await supabase
    .from("checklist_records" as never)
    .select("*")
    .eq("unit_id", unitId)
    .gte("data", desde.toISOString().slice(0, 10))
    .order("data", { ascending: false })
    .order("created_at", { ascending: false })) as unknown as {
    data: ChecklistRecordRow[] | null;
    error: { message: string } | null;
  };
  if (error) {
    console.error("[listChecklistRecords]", error.message);
    return [];
  }
  return data ?? [];
}

export async function submitChecklistRecord(
  input: Omit<ChecklistRecordRow, "id" | "created_at">,
): Promise<ActionResult<ChecklistRecordRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { data, error } = (await supabase
    .from("checklist_records" as never)
    .insert(input as never)
    .select()
    .single()) as unknown as {
    data: ChecklistRecordRow | null;
    error: { message: string } | null;
  };
  if (error || !data) {
    console.error("[submitChecklistRecord]", error?.message);
    return { ok: false, error: error?.message ?? "Falha" };
  }
  revalidatePath("/operacao/auditorias");
  return { ok: true, data };
}

export async function createChecklist(
  input: Omit<QualityChecklistRow, "id" | "created_at">,
): Promise<ActionResult<QualityChecklistRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { data, error } = (await supabase
    .from("quality_checklists" as never)
    .insert(input as never)
    .select()
    .single()) as unknown as {
    data: QualityChecklistRow | null;
    error: { message: string } | null;
  };
  if (error || !data) {
    console.error("[createChecklist]", error?.message);
    return { ok: false, error: error?.message ?? "Falha" };
  }
  revalidatePath("/operacao/auditorias");
  return { ok: true, data };
}
