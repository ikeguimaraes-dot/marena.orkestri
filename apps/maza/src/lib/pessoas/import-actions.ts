"use server";

// Server Actions do módulo Importação Totvs (Pessoas → /pessoas/importacao).
//
// Match dos colaboradores por CPF normalizado (11 dígitos).
// Insere em time_records (e overtime_records quando há horas positivas).
// Loga em import_logs com tipo='ponto'.

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@maza/db/supabase/server";
import { requireUser } from "@maza/auth/server";
import type { ActionResult } from "@/lib/result";
import {
  csvRowToOvertimeRecord,
  csvRowToTimeRecord,
  normalizeCpf,
  parsePeriodoIso,
  type PontoCsvRow,
} from "@/lib/pessoas/csv-parser";
import type { ImportLog } from "@maza/db/types/pessoas";

export type ImportSummary = {
  log_id: string;
  periodo: string;
  total_linhas: number;
  importados: number;
  nao_encontrados: string[];
  erros: string[];
};

/**
 * Importa as linhas do CSV pra time_records + overtime_records da unit.
 * Salva o resultado em import_logs.
 */
export async function processPontoImport(
  unitId: string,
  rows: PontoCsvRow[],
): Promise<ActionResult<ImportSummary>> {
  try {
    if (!rows || rows.length === 0) {
      return { ok: false, error: "Nenhuma linha pra importar" };
    }
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    // Período é resolvido a partir da primeira linha válida.
    let periodoIso: string | null = null;
    for (const r of rows) {
      const p = parsePeriodoIso(r.periodo);
      if (p) {
        periodoIso = p;
        break;
      }
    }
    if (!periodoIso) {
      return { ok: false, error: "Não foi possível detectar o período do CSV" };
    }

    // 1) Mapeia CPF → employee_id da unit (escopo: só colaboradores ATIVOS
    //    da unit selecionada).
    const { data: empRows, error: empErr } = await supabase
      .from("employees")
      .select("id, cpf, nome, sobrenome")
      .eq("unit_id", unitId);
    if (empErr) {
      return { ok: false, error: `Erro buscando colaboradores: ${empErr.message}` };
    }
    type EmpRow = { id: string; cpf: string | null; nome: string; sobrenome: string };
    const empByCpf = new Map<string, EmpRow>();
    for (const e of (empRows ?? []) as EmpRow[]) {
      if (e.cpf) empByCpf.set(normalizeCpf(e.cpf), e);
    }

    let importados = 0;
    const naoEncontrados: string[] = [];
    const erros: string[] = [];

    for (const row of rows) {
      const cpf = normalizeCpf(row.cpf);
      const emp = empByCpf.get(cpf);
      if (!emp) {
        naoEncontrados.push(`${row.nome} (CPF ${cpf})`);
        continue;
      }
      const tr = csvRowToTimeRecord(row, emp.id, unitId);
      if (!tr) {
        erros.push(`${row.nome}: período inválido (\"${row.periodo}\")`);
        continue;
      }
      const { error: trErr } = await supabase
        .from("time_records")
        .insert(tr as never);
      if (trErr) {
        erros.push(`${row.nome}: ${trErr.message}`);
        continue;
      }
      importados += 1;

      const ot = csvRowToOvertimeRecord(row, emp.id, unitId);
      if (ot) {
        const { error: otErr } = await supabase
          .from("overtime_records")
          .insert(ot as never);
        if (otErr) {
          // não conta como erro do main flow — só registra
          erros.push(`${row.nome} (overtime): ${otErr.message}`);
        }
      }
    }

    // 2) Persistir log
    const logPayload = {
      unit_id: unitId,
      periodo: periodoIso,
      tipo: "ponto" as const,
      total_linhas: rows.length,
      importados,
      nao_encontrados: naoEncontrados.length,
      erros: erros.length,
      detalhes: { not_found: naoEncontrados, errors: erros },
      imported_by: user.id,
    };
    const { data: logRow, error: logErr } = await supabase
      .from("import_logs")
      .insert(logPayload as never)
      .select()
      .single();
    if (logErr) {
      return { ok: false, error: `Falha registrando log: ${logErr.message}` };
    }

    revalidatePath("/pessoas/importacao");
    revalidatePath("/pessoas");

    return {
      ok: true,
      data: {
        log_id: (logRow as { id: string }).id,
        periodo: periodoIso,
        total_linhas: rows.length,
        importados,
        nao_encontrados: naoEncontrados,
        erros,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/** Histórico de importações da unit (mais recentes primeiro). */
export async function listImportLogs(
  unitId: string,
  limit = 20,
): Promise<ImportLog[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("import_logs")
      .select("*")
      .eq("unit_id", unitId)
      .order("imported_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[listImportLogs]", error.message);
      return [];
    }
    return (data ?? []) as ImportLog[];
  } catch (e) {
    console.error("[listImportLogs] exceção:", e);
    return [];
  }
}
