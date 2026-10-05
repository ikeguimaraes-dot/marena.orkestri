"use server";

// Server Actions do módulo Campanhas (comunicação interna).
//
// Upload de imagem → bucket `campaign-images` (policy public_read +
// auth_upload). Salva apenas o storage path em `image_url`.

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@maza/db/supabase/server";
import { requireUser } from "@maza/auth/server";
import type { ActionResult } from "@/lib/result";
import { campaignSchema, type CampaignFormValues } from "@/lib/campanhas/schema";
import type {
  Campaign,
  CampaignUpdate,
  CampaignWithBrand,
} from "@/lib/campanhas/types";

const TABLE = "campaigns" as const;
const BUCKET = "campaign-images";

export async function listCampaigns(
  brandId?: string | null,
): Promise<CampaignWithBrand[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    let q = supabase
      .from(TABLE)
      .select("*, brand:brands(name, color)")
      .order("created_at", { ascending: false });
    if (brandId) q = q.eq("brand_id", brandId);

    type JoinRow = Campaign & {
      brand: { name: string; color: string } | { name: string; color: string }[] | null;
    };
    const { data, error } = await q.returns<JoinRow[]>();
    if (error) {
      console.error("[listCampaigns]", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const b = Array.isArray(r.brand) ? r.brand[0] : r.brand;
      return {
        ...r,
        brand_name: b?.name ?? null,
        brand_color: b?.color ?? null,
      } as CampaignWithBrand;
    });
  } catch (e) {
    console.error("[listCampaigns] exceção:", e);
    return [];
  }
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[getCampaign]", error.message);
      return null;
    }
    return (data as Campaign | null) ?? null;
  } catch (e) {
    console.error("[getCampaign] exceção:", e);
    return null;
  }
}

export async function createCampaign(
  input: CampaignFormValues,
): Promise<ActionResult<Campaign>> {
  try {
    const parsed = campaignSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
    }
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const payload = {
      brand_id: parsed.data.brand_id ?? null,
      unit_id: parsed.data.unit_id ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      image_url: parsed.data.image_url ?? null,
      category: parsed.data.category,
      target: parsed.data.target ?? "all",
      target_value: parsed.data.target_value ?? null,
      active: parsed.data.active ?? true,
      starts_at: parsed.data.starts_at ?? null,
      ends_at: parsed.data.ends_at ?? null,
      created_by: user.id,
    };

    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    revalidatePath("/campanhas");
    return { ok: true, data: data as Campaign };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateCampaign(
  id: string,
  patch: CampaignUpdate,
): Promise<ActionResult<Campaign>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    revalidatePath("/campanhas");
    return { ok: true, data: data as Campaign };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function toggleCampaignActive(
  id: string,
): Promise<ActionResult<Campaign>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data: current } = await supabase
      .from(TABLE)
      .select("active")
      .eq("id", id)
      .maybeSingle<{ active: boolean }>();
    if (!current) return { ok: false, error: "Campanha não encontrada" };
    return updateCampaign(id, { active: !current.active });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function deleteCampaign(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/campanhas");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/**
 * Faz upload de imagem pro bucket campaign-images e retorna o path.
 * UI chama essa antes de createCampaign — pra ter o image_url já pronto
 * no payload do form.
 */
export async function uploadCampaignImage(
  file: File,
): Promise<ActionResult<{ path: string }>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `campaigns/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { ok: false, error: error.message };

    return { ok: true, data: { path } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/** Public URL pra renderizar imagem na UI (bucket é público). */
export async function getCampaignImagePublicUrl(
  storagePath: string | null,
): Promise<string | null> {
  if (!storagePath) return null;
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}
