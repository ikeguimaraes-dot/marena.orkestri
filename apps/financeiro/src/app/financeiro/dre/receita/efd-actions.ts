"use server";
import { z } from "zod";
import { createFinanceiroClient } from "@/lib/financeiro/db/client";
import { parseEfdResumo, type EfdResumo } from "@/lib/receita/efd";

export async function listEfd(unitId: string, competencia: string): Promise<{ rows: EfdResumo[]; error?: string }> {
  try {
    z.uuid().parse(unitId);
    z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/).parse(competencia);
    const db = await createFinanceiroClient();
    const { data, error } = await db.from("receita_fiscal_efd").select("cnpj,competencia,receita,pis,cofins").eq("unit_id", unitId).eq("competencia", competencia);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  } catch (e) { return { rows: [], error: e instanceof Error ? e.message : String(e) }; }
}

export async function saveEfd(input: unknown) {
  try {
    const { unitId, text, filename } = z.object({ unitId: z.uuid(), text: z.string().min(1).max(100_000), filename: z.string().min(1).max(255) }).parse(input);
    const db = await createFinanceiroClient();
    // Reparse the evidence on the server; do not trust client-provided totals.
    const resumo = parseEfdResumo(text);
    const { data: mapping, error: mappingError } = await db.from("unit_cnpjs").select("unit_id").eq("cnpj", resumo.cnpj).eq("unit_id", unitId).eq("ativo", true).maybeSingle();
    if (mappingError) throw new Error(mappingError.message);
    if (!mapping) throw new Error("O CNPJ do PDF não pertence à unidade selecionada ou não está acessível.");
    const { error } = await db.from("receita_fiscal_efd").upsert({ ...resumo, unit_id: unitId, arquivo: filename, resumo_texto: text, atualizado_em: new Date().toISOString() }, { onConflict: "unit_id,cnpj,competencia" });
    if (error) throw new Error(error.message);
    return { ok: true as const, resumo };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : String(e) }; }
}
