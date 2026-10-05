"use server";

// Cálculo mensal de bonificações (score positivo).
//
// Regras:
//   +5 ASSIDUIDADE: mês sem faltas injustificadas no employee_id
//   +3 PONTUALIDADE: mês com 0 punches rejeitados (aprovado=false)
//   +2 ANIVERSARIO_ADMISSAO: 1 ano completado dentro do mês (mês de admissão === mês do período)
//
// Idempotente por chave (employee_id, tipo, periodo). Usa referencia_id =
// 'YYYY-MM-01' (date) pra detectar duplicidade — verificação prévia antes
// do insert. Score do employee é recalculado no final.

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@maza/db/supabase/server";
import { requireUser } from "@maza/auth/server";
import type { ActionResult } from "@/lib/result";
import { SCORE_BONUS, SCORE_BASE, SCORE_FLOOR, SCORE_CEIL } from "@/lib/pessoas/score";

export type MonthlyBonusResult = {
  unit_id: string;
  periodo: string;
  events_inserted: number;
  detail: {
    assiduidade: number;
    pontualidade: number;
    aniversario: number;
  };
};

/** Garante 'YYYY-MM-01' (primeiro dia do mês). */
function periodoToDate(periodo: string): string {
  // aceita 'YYYY-MM' ou 'YYYY-MM-DD'
  const m = periodo.match(/^(\d{4})-(\d{2})/);
  if (!m) return periodo;
  return `${m[1]}-${m[2]}-01`;
}

function nextMonthDate(periodoFirst: string): string {
  const [y, m] = periodoFirst.split("-").map(Number);
  if (!y || !m) return periodoFirst;
  const yy = m === 12 ? y + 1 : y;
  const mm = m === 12 ? 1 : m + 1;
  return `${yy}-${String(mm).padStart(2, "0")}-01`;
}

/** Recalcula score = clamp(100 + sum(deltas), 0, 100) e persiste em employees.score. */
export async function recalcEmployeeScore(
  employeeId: string,
): Promise<number | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("score_events")
      .select("delta")
      .eq("employee_id", employeeId);
    if (error) {
      console.error("[recalcEmployeeScore]", error.message);
      return null;
    }
    const sum = (data ?? []).reduce(
      (a, r) => a + ((r as { delta: number }).delta ?? 0),
      0,
    );
    const next = Math.max(SCORE_FLOOR, Math.min(SCORE_CEIL, SCORE_BASE + sum));
    const { error: updErr } = await supabase
      .from("employees")
      .update({ score: next } as never)
      .eq("id", employeeId);
    if (updErr) {
      console.error("[recalcEmployeeScore/update]", updErr.message);
    }
    return next;
  } catch (e) {
    console.error("[recalcEmployeeScore] exceção:", e);
    return null;
  }
}

/**
 * Roda os 3 cálculos mensais pra todos os colaboradores ativos da unit no
 * período informado. Retorna contagens por categoria. Apenas founder/cfo/gm/rh
 * deveriam disparar — RLS já barra inserts indevidos.
 */
export async function calcMonthlyBonuses(
  unitId: string,
  periodo: string,
): Promise<ActionResult<MonthlyBonusResult>> {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const periodoDate = periodoToDate(periodo);
    const nextDate = nextMonthDate(periodoDate);

    // 1) Colaboradores ativos da unit
    const { data: empRows, error: empErr } = await supabase
      .from("employees")
      .select("id, data_admissao")
      .eq("unit_id", unitId)
      .eq("ativo", true);
    if (empErr) return { ok: false, error: empErr.message };
    type EmpRow = { id: string; data_admissao: string };
    const employees = (empRows ?? []) as EmpRow[];
    if (employees.length === 0) {
      return {
        ok: true,
        data: {
          unit_id: unitId,
          periodo: periodoDate,
          events_inserted: 0,
          detail: { assiduidade: 0, pontualidade: 0, aniversario: 0 },
        },
      };
    }
    const empIds = employees.map((e) => e.id);

    // 2) Faltas injustificadas no mês (employee_id que tem alguma)
    const { data: absRows, error: absErr } = await supabase
      .from("absences")
      .select("employee_id")
      .in("employee_id", empIds)
      .eq("tipo", "injustificada")
      .gte("data", periodoDate)
      .lt("data", nextDate);
    if (absErr) return { ok: false, error: absErr.message };
    const empWithAbsence = new Set(
      (absRows ?? []).map((r) => (r as { employee_id: string }).employee_id),
    );

    // 3) Punches rejeitados no mês (aprovado = false)
    const { data: punchRows, error: punchErr } = await supabase
      .from("time_clock_punches")
      .select("employee_id")
      .in("employee_id", empIds)
      .eq("aprovado", false)
      .gte("timestamp_punch", `${periodoDate}T00:00:00Z`)
      .lt("timestamp_punch", `${nextDate}T00:00:00Z`);
    if (punchErr) return { ok: false, error: punchErr.message };
    const empWithRejected = new Set(
      (punchRows ?? []).map((r) => (r as { employee_id: string }).employee_id),
    );

    // 4) Eventos já existentes pra esse período (evita duplicar)
    const { data: existing, error: exErr } = await supabase
      .from("score_events")
      .select("employee_id, tipo, referencia_id")
      .in("employee_id", empIds)
      .eq("referencia_id", periodoDate);
    if (exErr) return { ok: false, error: exErr.message };
    const existingKey = new Set(
      (existing ?? []).map(
        (r) =>
          `${(r as { employee_id: string }).employee_id}|${(r as { tipo: string }).tipo}`,
      ),
    );

    // Mês do período (1-12) pra checar aniversário
    const periodoMonth = Number(periodoDate.slice(5, 7));

    type Insert = {
      employee_id: string;
      tipo: string;
      delta: number;
      descricao: string;
      referencia_id: string;
    };
    const inserts: Insert[] = [];
    let assiduidade = 0;
    let pontualidade = 0;
    let aniversario = 0;

    for (const e of employees) {
      // Assiduidade
      if (
        !empWithAbsence.has(e.id) &&
        !existingKey.has(`${e.id}|assiduidade_mensal`)
      ) {
        inserts.push({
          employee_id: e.id,
          tipo: "assiduidade_mensal",
          delta: SCORE_BONUS.ASSIDUIDADE_MENSAL,
          descricao: `Mês ${periodoDate.slice(0, 7)} sem faltas injustificadas`,
          referencia_id: periodoDate,
        });
        assiduidade += 1;
      }
      // Pontualidade
      if (
        !empWithRejected.has(e.id) &&
        !existingKey.has(`${e.id}|pontualidade_mensal`)
      ) {
        inserts.push({
          employee_id: e.id,
          tipo: "pontualidade_mensal",
          delta: SCORE_BONUS.PONTUALIDADE_MENSAL,
          descricao: `Mês ${periodoDate.slice(0, 7)} com 100% pontualidade`,
          referencia_id: periodoDate,
        });
        pontualidade += 1;
      }
      // Aniversário de admissão (mês bate, ano de adm < ano do período)
      if (e.data_admissao) {
        const admMonth = Number(e.data_admissao.slice(5, 7));
        const admYear = Number(e.data_admissao.slice(0, 4));
        const periYear = Number(periodoDate.slice(0, 4));
        if (
          admMonth === periodoMonth &&
          admYear < periYear &&
          !existingKey.has(`${e.id}|aniversario_admissao`)
        ) {
          inserts.push({
            employee_id: e.id,
            tipo: "aniversario_admissao",
            delta: SCORE_BONUS.ANIVERSARIO_ADMISSAO,
            descricao: `${periYear - admYear} ano(s) de casa`,
            referencia_id: periodoDate,
          });
          aniversario += 1;
        }
      }
    }

    // 5) Insert em batch
    if (inserts.length > 0) {
      const { error: insErr } = await supabase
        .from("score_events")
        .insert(inserts as never);
      if (insErr) return { ok: false, error: insErr.message };

      // recalcula score dos empregados afetados
      const affected = Array.from(new Set(inserts.map((i) => i.employee_id)));
      for (const empId of affected) {
        await recalcEmployeeScore(empId);
      }
    }

    revalidatePath("/pessoas/disciplina");

    return {
      ok: true,
      data: {
        unit_id: unitId,
        periodo: periodoDate,
        events_inserted: inserts.length,
        detail: { assiduidade, pontualidade, aniversario },
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/** Wrapper público — mesma assinatura, só pra exposição via UI. */
export async function triggerMonthlyScore(
  unitId: string,
  periodo: string,
): Promise<ActionResult<MonthlyBonusResult>> {
  return calcMonthlyBonuses(unitId, periodo);
}
