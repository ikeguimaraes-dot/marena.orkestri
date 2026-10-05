// src/app/(dashboard)/operacao/performance/actions.ts
"use server";
import { createSupabaseServerClient } from "@kph/db/supabase/server";

export type PerformanceKpis = {
  headcountAtivo: number;
  headcountPorFuncao: { funcao: string; count: number }[];
  faltasMes: number;
  absenteismoPct: number;
  heHorasMes: number;
  hePendentes: number;
  checklistScoreMedio: number | null;
  checklistRegistros: number;
};

type OTKpiRow = {
  id: string;
  hours: number | string | null;
  approved: boolean | null;
};

type EmpKpiRow = {
  id: string;
  funcao: string | null;
};

type CheckKpiRow = {
  score_pct: number | null;
};

export async function getPerformanceKpis(
  unitId: string,
  mes: number,
  ano: number,
): Promise<PerformanceKpis> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return emptyKpis();

  const mesStr = String(mes).padStart(2, "0");
  const start = `${ano}-${mesStr}-01`;
  const lastDay = new Date(ano, mes, 0).getDate();
  const end = `${ano}-${mesStr}-${String(lastDay).padStart(2, "0")}`;

  const [empRes, faltasRes, heRes, checkRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, funcao")
      .eq("unit_id", unitId)
      .eq("status", "ativo")
      .returns<EmpKpiRow[]>(),
    supabase
      .from("absences")
      .select("id")
      .eq("unit_id", unitId)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("overtime_records")
      .select("id, hours, approved, employees!inner(unit_id)")
      .eq("employees.unit_id", unitId)
      .gte("date", start)
      .lte("date", end)
      .returns<OTKpiRow[]>(),
    supabase
      .from("checklist_records")
      .select("score_pct")
      .eq("unit_id", unitId)
      .gte("data", start)
      .lte("data", end)
      .returns<CheckKpiRow[]>(),
  ]);

  if (empRes.error) console.error("[getPerformanceKpis] employees:", empRes.error.message);
  if (faltasRes.error) console.error("[getPerformanceKpis] absences:", faltasRes.error.message);
  if (heRes.error) console.error("[getPerformanceKpis] overtime:", heRes.error.message);
  if (checkRes.error) console.error("[getPerformanceKpis] checklists:", checkRes.error.message);

  const employees = empRes.data ?? [];
  const faltas = faltasRes.data ?? [];
  const hes = heRes.data ?? [];
  const checks = (checkRes.data ?? []).filter((c) => c.score_pct !== null);

  const headcountAtivo = employees.length;
  const faltasMes = faltas.length;
  const diasUteis = 22; // approximation; exact calendar calc not yet implemented
  const absenteismoPct =
    headcountAtivo > 0
      ? Math.round((faltasMes / (headcountAtivo * diasUteis)) * 100 * 10) / 10
      : 0;

  const funcaoCounts = new Map<string, number>();
  for (const e of employees) {
    const f = e.funcao ?? "Sem função";
    funcaoCounts.set(f, (funcaoCounts.get(f) ?? 0) + 1);
  }
  const headcountPorFuncao = Array.from(funcaoCounts.entries())
    .map(([funcao, count]) => ({ funcao, count }))
    .sort((a, b) => b.count - a.count);

  const heHorasMes = hes.reduce((s, h) => s + (h.hours == null ? 0 : Number(h.hours)), 0);
  const hePendentes = hes.filter((h) => h.approved === null).length;

  const checklistScoreMedio =
    checks.length > 0
      ? Math.round(checks.reduce((s, c) => s + c.score_pct!, 0) / checks.length)
      : null;

  return {
    headcountAtivo,
    headcountPorFuncao,
    faltasMes,
    absenteismoPct,
    heHorasMes,
    hePendentes,
    checklistScoreMedio,
    checklistRegistros: checks.length,
  };
}

function emptyKpis(): PerformanceKpis {
  return {
    headcountAtivo: 0,
    headcountPorFuncao: [],
    faltasMes: 0,
    absenteismoPct: 0,
    heHorasMes: 0,
    hePendentes: 0,
    checklistScoreMedio: null,
    checklistRegistros: 0,
  };
}
