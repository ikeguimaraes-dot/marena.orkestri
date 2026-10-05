"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@maza/db/supabase/server";
import { requireUser } from "@maza/auth/server";
import type { ActionResult } from "@/lib/result";

export type TipoRelatorio = "folha_mensal" | "adiantamento" | "relatorio_bancario";

const TIPO_LABELS: Record<TipoRelatorio, string> = {
  folha_mensal: "Folha Mensal",
  adiantamento: "Adiantamento",
  relatorio_bancario: "Relatório Bancário",
};

export interface PayrollReport {
  id: string;
  name: string;
  type: string;
  notes: string | null;
  storage_path: string;
  unit_id: string | null;
  uploaded_at: string | null;
}

export async function uploadPayrollReport(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {

  const file = formData.get("file") as File | null;
  const competencia = formData.get("competencia") as string | null;
  const tipo = formData.get("tipo") as TipoRelatorio | null;
  const unitId = formData.get("unitId") as string | null;

  if (!file || file.size === 0) {
    return { ok: false, error: "Nenhum arquivo selecionado." };
  }
  if (file.type !== "application/pdf") {
    return { ok: false, error: "Apenas arquivos PDF são aceitos." };
  }
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    return { ok: false, error: "Competência inválida. Use o formato YYYY-MM." };
  }
  if (!tipo || !TIPO_LABELS[tipo]) {
    return { ok: false, error: "Tipo de relatório inválido." };
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Erro de configuração do servidor." };
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const folder = unitId ?? "geral";
  const storagePath = `${folder}/${competencia}_${tipo}_${timestamp}_${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: storageError } = await supabase.storage
    .from("payroll-reports")
    .upload(storagePath, arrayBuffer, { contentType: "application/pdf" });

  if (storageError) {
    return { ok: false, error: `Erro no upload: ${storageError.message}` };
  }

  const notes = `${competencia} — ${TIPO_LABELS[tipo]}`;

  // employee_id e type requerem migration 019_payroll_reports.sql antes de usar em prod
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertError } = await (supabase as any)
    .from("documents")
    .insert({
      employee_id: null,
      unit_id: unitId ?? null,
      name: file.name,
      type: "relatorio_folha",
      storage_path: storagePath,
      notes,
    })
    .select("id")
    .single();

  if (insertError) {
    return { ok: false, error: `Erro ao registrar documento: ${insertError.message}` };
  }

  revalidatePath("/financeiro/relatorios");
  return { ok: true, data: { id: inserted.id } };
}

export async function listPayrollReports(unitId?: string): Promise<PayrollReport[]> {

  const supabase = createServiceClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("documents")
    .select("id, name, type, notes, storage_path, unit_id, uploaded_at")
    .eq("type", "relatorio_folha")
    .order("uploaded_at", { ascending: false });

  if (unitId) {
    query = query.eq("unit_id", unitId);
  }

  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function getPayrollReportUrl(
  storagePath: string
): Promise<ActionResult<{ url: string }>> {

  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Erro de configuração do servidor." };
  }

  const { data, error } = await supabase.storage
    .from("payroll-reports")
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    return { ok: false, error: "Não foi possível gerar o link de acesso." };
  }

  return { ok: true, data: { url: data.signedUrl } };
}
