"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@maza/db/supabase/server";
import { requireUser } from "@maza/auth/server";
import type { ActionResult } from "@/lib/result";

export type PontoMensalInput = {
  matricula: string;
  nome: string;
  cpf: string;
  cargo: string;
  departamento: string;
  data_admissao: string;
  data_demissao: string;
  horas_previstas: string;
  horas_trabalhadas: string;
  horas_negativas: string;
  horas_positivas: string;
  saldo: string;
  banco_horas_acumulado: string;
  banco_horas_mes: string;
  compensacao_bh: string;
  adicional_noturno: string;
  falta_injustificada_horas: string;
  falta_injustificada_dias: number;
  atestado_medico: string;
  abonado_horas: string;
  abonado_dias: number;
  afastamentos_horas: string;
  afastamentos_dias: number;
  inss_horas: string;
  inss_dias: number;
  ferias_horas: string;
  ferias_dias: number;
  licenca_paternidade_horas: string;
  licenca_paternidade_dias: number;
  folga_domingo: string;
  folga_feriado: string;
  feriados_dias: number;
  confraternizacao: string;
};

export type PontoMensalRow = PontoMensalInput & {
  id: string;
  unit_id: string;
  periodo: string;
  importado_em: string;
};

export async function importPontoMensal(
  unitId: string,
  periodo: string,
  rows: PontoMensalInput[],
): Promise<ActionResult<{ count: number }>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    // Apaga período anterior para esta unit antes de reimportar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error: delErr } = await sb
      .from("ponto_mensal")
      .delete()
      .eq("unit_id", unitId)
      .eq("periodo", periodo);

    if (delErr) return { ok: false, error: (delErr as { message: string }).message };

    const payload = rows.map((r) => ({ ...r, unit_id: unitId, periodo }));

    const { error: insErr } = await sb
      .from("ponto_mensal")
      .insert(payload);

    if (insErr) return { ok: false, error: (insErr as { message: string }).message };

    revalidatePath("/pessoas/relatorio-ponto");
    return { ok: true, data: { count: rows.length } };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function listPontoPeriodos(
  unitId: string,
): Promise<string[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data } = await sb
      .from("ponto_mensal")
      .select("periodo")
      .eq("unit_id", unitId)
      .eq("is_total", false)
      .order("periodo", { ascending: false });

    if (!data) return [];
    const unique = Array.from(new Set((data as { periodo: string }[]).map((r) => r.periodo)));
    return unique;
  } catch {
    return [];
  }
}

export async function getPontoMensal(
  unitId: string,
  periodo: string,
): Promise<PontoMensalRow[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data } = await sb
      .from("ponto_mensal")
      .select("*")
      .eq("unit_id", unitId)
      .eq("periodo", periodo)
      .order("nome", { ascending: true });

    return (data ?? []) as PontoMensalRow[];
  } catch {
    return [];
  }
}
