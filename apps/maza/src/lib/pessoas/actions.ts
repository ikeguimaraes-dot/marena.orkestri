"use server"
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createServiceClient } from "@maza/db/supabase/server";
import { requireUser, getCurrentUser } from "@maza/auth/server";
import { getCurrentUnit } from "@maza/auth/unit";import { createNotification } from "@/lib/notifications/actions";
import type { ActionResult } from "@/lib/result";
import { gerarHolerite } from "@/lib/pessoas/clt";
import type {
  Absence,
  AbsenceInsert,
  AbsenceTipo,
  AbsenceWithEmployee,
  Dependent,
  Employee,
  EmployeeInsert,
  EmployeeScore,
  EmployeeStub,
  EmployeeUpdate,
  GeneratePayslipInput,
  OvertimeRecord,
  OvertimeRecordInsert,
  OvertimeRecordUpdate,
  OvertimeRecordWithEmployee,
  Payslip,
  PayslipStatus,
  PayslipWithEmployee,
  PunchTipo,
  PunchWithEmployee,
  ScoreEvent,
  Shift,
  ShiftInsert,
  ShiftUpdate,
  TimeClockPunch,
  TimeRecord,
  TipsRecord,
  TipsRecordInsert,
  TipsRecordUpdate,
  TipsRecordWithEmployee,
  TransportVoucher,
  TransportVoucherInsert,
  TransportVoucherUpdate,
  TransportVoucherWithEmployee,
  Vacation,
  VacationInsert,
  VacationStatus,
  VacationUpdate,
  Warning,
  WarningInsert,
  WarningNivel,
  WarningWithEmployee,
} from "@maza/db/types/pessoas";
import { deltaForAbsence, deltaForWarning, calcScore } from "@/lib/pessoas/score";

const TABLE = "employees" as const;
const SHIFTS_TABLE = "shifts" as const;
const PAYSLIPS_TABLE = "payslips" as const;
const WARNINGS_TABLE = "warnings" as const;
const ABSENCES_TABLE = "absences" as const;
const SCORE_EVENTS_TABLE = "score_events" as const;
const PUNCHES_TABLE = "time_clock_punches" as const;
const TIPS_TABLE = "tips_records" as const;
const VT_TABLE = "transport_vouchers" as const;
const OT_TABLE = "overtime_records" as const;
const VAC_TABLE = "vacations" as const;
const TIMEREC_TABLE = "time_records" as const;

// Nota: o builder do @supabase/ssr infere `never` em insert/update quando
// PostgrestVersion 12 + custom Database<T>. As entradas já estão validadas
// pelo zod schema antes de chegar aqui — `as never` é só pra TypeScript engolir.
// Boundary tipado fica nas funções (EmployeeInsert/EmployeeUpdate).

/**
 * Lista colaboradores de uma unit. RLS garante que o user só vê units onde
 * tem role. Retorna array vazio em qualquer falha — UI mostra empty state.
 */
export async function listEmployees(unitId: string): Promise<Employee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      console.warn("[listEmployees] supabase indisponível");
      return [];
    }
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("unit_id", unitId)
      .order("ativo", { ascending: false })
      .order("nome", { ascending: true })
      .order("sobrenome", { ascending: true });
    if (error) {
      console.error("[listEmployees] query error:", error.message, "unit:", unitId);
      return [];
    }
    return (data as Employee[] | null) ?? [];
  } catch (e) {
    console.error("[listEmployees] exceção:", e);
    return [];
  }
}

/** Lista dependentes de um colaborador. RLS filtra via employees.unit_id. */
export async function listDependents(employeeId: string): Promise<Dependent[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("dependents")
      .select("*")
      .eq("employee_id", employeeId)
      .order("ordem", { ascending: true });
    if (error) {
      console.error("[listDependents] query error:", error.message, "employee:", employeeId);
      return [];
    }
    return (data as Dependent[] | null) ?? [];
  } catch (e) {
    console.error("[listDependents] exceção:", e);
    return [];
  }
}

/** Busca colaborador por id. Retorna null se não existe ou sem permissão. */
export async function getEmployee(id: string): Promise<Employee | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[getEmployee] query error:", error.message, "id:", id);
      return null;
    }
    return (data as Employee | null) ?? null;
  } catch (e) {
    console.error("[getEmployee] exceção:", e);
    return null;
  }
}

export async function createEmployee(
  input: EmployeeInsert,
): Promise<ActionResult<Employee>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(TABLE)
      .insert(input as never)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao criar" };
    }
    revalidatePath("/pessoas/colaboradores");
    revalidatePath("/pessoas");
    return { ok: true, data: data as Employee };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

export async function updateEmployee(
  id: string,
  patch: EmployeeUpdate,
): Promise<ActionResult<Employee>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar" };
    }
    revalidatePath("/pessoas/colaboradores");
    revalidatePath(`/pessoas/colaboradores/${id}/editar`);
    return { ok: true, data: data as Employee };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

/**
 * Lista turnos da unit num intervalo (inclusivo). RLS já restringe à unit.
 * Datas em ISO "YYYY-MM-DD".
 */
export async function listShifts(
  unitId: string,
  dataInicio: string,
  dataFim: string,
): Promise<Shift[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      console.warn("[listShifts] supabase indisponível");
      return [];
    }
    const { data, error } = await supabase
      .from(SHIFTS_TABLE)
      .select("*")
      .eq("unit_id", unitId)
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true });
    if (error) {
      console.error("[listShifts] query error:", error.message, "unit:", unitId);
      return [];
    }
    return (data as Shift[] | null) ?? [];
  } catch (e) {
    console.error("[listShifts] exceção:", e);
    return [];
  }
}

export async function createShift(
  input: ShiftInsert,
): Promise<ActionResult<Shift>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(SHIFTS_TABLE)
      .insert(input as never)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao criar turno" };
    }
    revalidatePath("/pessoas/escala");
    return { ok: true, data: data as Shift };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

export async function updateShift(
  id: string,
  patch: ShiftUpdate,
): Promise<ActionResult<Shift>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(SHIFTS_TABLE)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar turno" };
    }
    revalidatePath("/pessoas/escala");
    return { ok: true, data: data as Shift };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

export async function deleteShift(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { error } = await supabase.from(SHIFTS_TABLE).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/pessoas/escala");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

/**
 * Copia turnos da semana anterior pra a semana iniciada em `weekStartIso`.
 * Mantém colaborador, horários, tipo e observação — apenas desloca a data
 * em +7 dias. Não duplica turnos que já existam na semana destino (mesma
 * tupla employee+data).
 */
export async function copyShiftsFromPreviousWeek(
  unitId: string,
  weekStartIso: string,
): Promise<ActionResult<{ copied: number; skipped: number }>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const start = new Date(`${weekStartIso}T00:00:00Z`);
    if (Number.isNaN(start.getTime())) {
      return { ok: false, error: "Data inválida" };
    }
    const prevStart = new Date(start);
    prevStart.setUTCDate(start.getUTCDate() - 7);
    const prevEnd = new Date(start);
    prevEnd.setUTCDate(start.getUTCDate() - 1);

    const prevStartIso = prevStart.toISOString().slice(0, 10);
    const prevEndIso = prevEnd.toISOString().slice(0, 10);
    const currEndIso = new Date(start.getTime() + 6 * 86400000)
      .toISOString()
      .slice(0, 10);

    // 1) shifts da semana anterior
    const { data: prev, error: prevErr } = await supabase
      .from(SHIFTS_TABLE)
      .select("*")
      .eq("unit_id", unitId)
      .gte("data", prevStartIso)
      .lte("data", prevEndIso);
    if (prevErr) return { ok: false, error: prevErr.message };
    if (!prev || prev.length === 0) {
      return { ok: true, data: { copied: 0, skipped: 0 } };
    }

    // 2) shifts da semana atual (pra evitar duplicar tuplas (employee, data))
    const { data: curr, error: currErr } = await supabase
      .from(SHIFTS_TABLE)
      .select("employee_id, data")
      .eq("unit_id", unitId)
      .gte("data", weekStartIso)
      .lte("data", currEndIso);
    if (currErr) return { ok: false, error: currErr.message };
    const existingKeys = new Set(
      (curr ?? []).map(
        (r) =>
          `${(r as { employee_id: string }).employee_id}|${(r as { data: string }).data}`,
      ),
    );

    type PrevRow = {
      employee_id: string;
      unit_id: string;
      data: string;
      hora_inicio: string;
      hora_fim: string;
      tipo: string | null;
      labor_cost: string | null;
      observacao: string | null;
    };

    let skipped = 0;
    const inserts: PrevRow[] = [];
    for (const row of prev as PrevRow[]) {
      const d = new Date(`${row.data}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 7);
      const newData = d.toISOString().slice(0, 10);
      const key = `${row.employee_id}|${newData}`;
      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }
      existingKeys.add(key);
      inserts.push({
        employee_id: row.employee_id,
        unit_id: row.unit_id,
        data: newData,
        hora_inicio: row.hora_inicio,
        hora_fim: row.hora_fim,
        tipo: row.tipo,
        labor_cost: row.labor_cost,
        observacao: row.observacao,
      });
    }

    if (inserts.length > 0) {
      const { error: insErr } = await supabase
        .from(SHIFTS_TABLE)
        .insert(inserts as never);
      if (insErr) return { ok: false, error: insErr.message };
    }

    revalidatePath("/pessoas/escala");
    return { ok: true, data: { copied: inserts.length, skipped } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

/**
 * Soft delete: marca ativo=false e seta data_demissao = hoje.
 * Não remove a row — preserva histórico de holerites/turnos.
 */
export async function deactivateEmployee(
  id: string,
): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from(TABLE)
      .update({
        ativo: false,
        data_demissao: today,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/pessoas/colaboradores");
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

// ── Holerites ──────────────────────────────────────────────────

type PayslipEmployeeJoin = Pick<Employee, "id" | "nome" | "sobrenome" | "funcao" | "salario_base"> & {
  unit_id?: string;
};

type PayslipJoinRow = Payslip & {
  employees: PayslipEmployeeJoin | PayslipEmployeeJoin[] | null;
};

/**
 * Lista holerites de uma unit (RLS já filtra). Pode filtrar por mês/ano.
 * Mês 1-12, ano 4 dígitos. Se ambos null, retorna últimos 100.
 */
export async function listPayslips(
  unitId: string,
  mes?: number,
  ano?: number,
): Promise<PayslipWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      console.warn("[listPayslips] supabase indisponível");
      return [];
    }

    let query = supabase
      .from(PAYSLIPS_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, salario_base, unit_id)")
      .eq("employees.unit_id", unitId)
      .order("competencia", { ascending: false });

    if (mes && ano) {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const endDate = new Date(ano, mes, 0); // último dia do mês
      const end = `${ano}-${String(mes).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
      query = query.gte("competencia", start).lte("competencia", end);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query.returns<PayslipJoinRow[]>();
    if (error) {
      console.error("[listPayslips] query error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => {
      const emp = Array.isArray(row.employees) ? row.employees[0] : row.employees;
      return {
        ...row,
        employee: emp ?? null,
      } as PayslipWithEmployee;
    });
  } catch (e) {
    console.error("[listPayslips] exceção:", e);
    return [];
  }
}

/** Busca holerite por id, com employee anexo. */
export async function getPayslip(id: string): Promise<PayslipWithEmployee | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(PAYSLIPS_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, salario_base, unit_id)")
      .eq("id", id)
      .maybeSingle<PayslipJoinRow>();
    if (error) {
      console.error("[getPayslip] query error:", error.message);
      return null;
    }
    if (!data) return null;
    const emp = Array.isArray(data.employees) ? data.employees[0] : data.employees;
    return { ...data, employee: emp ?? null } as PayslipWithEmployee;
  } catch (e) {
    console.error("[getPayslip] exceção:", e);
    return null;
  }
}

export type PayslipFull = {
  payslip: PayslipWithEmployee;
  employeeExtra: {
    cpf: string | null;
    pis: string | null;
    data_admissao: string;
    departamento: string | null;
  } | null;
  unit: { name: string; address: string | null } | null;
  brand: { name: string } | null;
};

export async function getPayslipFull(id: string): Promise<PayslipFull | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from(PAYSLIPS_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, salario_base, unit_id, cpf, pis, data_admissao, departamento)")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;

    const empRaw = (Array.isArray((data as any).employees)
      ? (data as any).employees[0]
      : (data as any).employees) as Record<string, any> | null;

    const payslip: PayslipWithEmployee = {
      ...(data as any),
      employee: empRaw
        ? { id: empRaw.id, nome: empRaw.nome, sobrenome: empRaw.sobrenome, funcao: empRaw.funcao, salario_base: empRaw.salario_base }
        : null,
    };

    const employeeExtra = empRaw
      ? { cpf: empRaw.cpf ?? null, pis: empRaw.pis ?? null, data_admissao: empRaw.data_admissao, departamento: empRaw.departamento ?? null }
      : null;

    let unit: { name: string; address: string | null } | null = null;
    let brand: { name: string } | null = null;

    if (empRaw?.unit_id) {
      const { data: unitData } = await supabase
        .from("units")
        .select("id, name, address, brand_id")
        .eq("id", empRaw.unit_id)
        .maybeSingle();

      if (unitData) {
        const u = unitData as any;
        unit = { name: u.name, address: u.address ?? null };

        if (u.brand_id) {
          const { data: brandData } = await supabase
            .from("brands")
            .select("id, name")
            .eq("id", u.brand_id)
            .maybeSingle();
          if (brandData) brand = { name: (brandData as any).name };
        }
      }
    }

    return { payslip, employeeExtra, unit, brand };
  } catch (e) {
    console.error("[getPayslipFull] exceção:", e);
    return null;
  }
}

/**
 * Calcula CLT completo (INSS, IRRF, HE, AdN, DSR/gorjeta) e UPSERT no banco.
 * Unique em (employee_id, competencia) garante 1 holerite por mês.
 * Retorna o registro persistido (rascunho).
 */
export async function generatePayslip(
  input: GeneratePayslipInput,
): Promise<ActionResult<Payslip>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data: emp, error: empErr } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", input.employeeId)
      .maybeSingle();
    if (empErr || !emp) {
      return { ok: false, error: empErr?.message ?? "Colaborador não encontrado" };
    }
    const employee = emp as Employee;
    const salarioBase = Number(employee.salario_base);

    // Shifts no mês.
    const start = `${input.ano}-${String(input.mes).padStart(2, "0")}-01`;
    const lastDay = new Date(input.ano, input.mes, 0).getDate();
    const end = `${input.ano}-${String(input.mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const { data: shiftsData, error: shiftsErr } = await supabase
      .from(SHIFTS_TABLE)
      .select("*")
      .eq("employee_id", input.employeeId)
      .gte("data", start)
      .lte("data", end);
    if (shiftsErr) {
      return { ok: false, error: `Falha ao buscar turnos: ${shiftsErr.message}` };
    }
    const shifts = (shiftsData ?? []) as Shift[];

    const calc = gerarHolerite({
      salarioBase,
      shifts,
      mes: input.mes,
      ano: input.ano,
      gorjeta: input.gorjeta ?? 0,
      dependentes: input.dependentes ?? 0,
      descontoVT: input.descontoVT ?? 0,
      descontoVR: input.descontoVR ?? 0,
    });

    const payload = {
      employee_id: input.employeeId,
      competencia: calc.competencia,
      salario_base: calc.salarioBase.toFixed(2),
      horas_extras: calc.horasExtras.toFixed(2),
      adicional_noturno: calc.adicionalNoturno.toFixed(2),
      gorjeta: calc.gorjeta.toFixed(2),
      dsr_gorjeta: calc.dsrGorjeta.toFixed(2),
      desconto_inss: calc.descontoInss.toFixed(2),
      desconto_irrf: calc.descontoIrrf.toFixed(2),
      desconto_vale_transporte: calc.descontoVT.toFixed(2),
      desconto_vale_refeicao: calc.descontoVR.toFixed(2),
      outros_descontos: "0.00",
      outros_acrescimos: "0.00",
      liquido: calc.liquido.toFixed(2),
      status: "rascunho" as PayslipStatus,
    };

    const { data, error } = await supabase
      .from(PAYSLIPS_TABLE)
      .upsert(payload as never, { onConflict: "employee_id,competencia" })
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao gravar holerite" };
    }
    revalidatePath("/pessoas/holerites");
    revalidatePath(`/pessoas/holerites/${(data as Payslip).id}`);
    return { ok: true, data: data as Payslip };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/**
 * Bulk: gera holerite (rascunho) pra todos os colaboradores ativos da unit.
 * Default gorjeta=0, dependentes=0 — ajuste fino fica no detalhe individual.
 */
export async function generatePayslipsForUnit(
  unitId: string,
  mes: number,
  ano: number,
): Promise<ActionResult<{ count: number; failures: string[] }>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data, error } = await supabase
      .from(TABLE)
      .select("id, nome, sobrenome")
      .eq("unit_id", unitId)
      .eq("ativo", true);
    if (error) return { ok: false, error: error.message };

    const employees = (data ?? []) as Array<Pick<Employee, "id" | "nome" | "sobrenome">>;
    const failures: string[] = [];
    let count = 0;
    for (const e of employees) {
      const res = await generatePayslip({ employeeId: e.id, mes, ano });
      if (res.ok) count++;
      else failures.push(`${e.nome} ${e.sobrenome}: ${res.error}`);
    }
    revalidatePath("/pessoas/holerites");
    return { ok: true, data: { count, failures } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/** Wrapper chamado diretamente do cliente — resolve a unit do cookie no servidor. */
export async function generatePayslipsCurrentUnit(
  mes: number,
  ano: number,
): Promise<ActionResult<{ count: number; failures: string[] }>> {
  const unit = await getCurrentUnit();
  if (!unit) return { ok: false, error: "Sem unidade selecionada" };
  return generatePayslipsForUnit(unit.id, mes, ano);
}

async function setPayslipStatus(
  id: string,
  status: PayslipStatus,
): Promise<ActionResult<Payslip>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(PAYSLIPS_TABLE)
      .update({ status } as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar status" };
    }
    revalidatePath("/pessoas/holerites");
    revalidatePath(`/pessoas/holerites/${id}`);
    return { ok: true, data: data as Payslip };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function approvePayslip(id: string): Promise<ActionResult<Payslip>> {
  return setPayslipStatus(id, "aprovado");
}

export async function markPayslipPaid(id: string): Promise<ActionResult<Payslip>> {
  return setPayslipStatus(id, "pago");
}

// ── Disciplina: warnings, absences, score ──────────────────────

type WarningJoinRow = Warning & {
  employees: EmployeeStub | EmployeeStub[] | null;
};
type AbsenceJoinRow = Absence & {
  employees: EmployeeStub | EmployeeStub[] | null;
};

function unwrapEmployee(
  e: EmployeeStub | EmployeeStub[] | null | undefined,
): EmployeeStub | null {
  if (!e) return null;
  return Array.isArray(e) ? (e[0] ?? null) : e;
}

/** Lista advertências da unit. RLS já filtra por employees.unit_id. */
export async function listWarnings(unitId: string): Promise<WarningWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(WARNINGS_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("employees.unit_id", unitId)
      .order("data", { ascending: false })
      .returns<WarningJoinRow[]>();
    if (error) {
      console.error("[listWarnings] error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      ...row,
      employee: unwrapEmployee(row.employees),
    })) as WarningWithEmployee[];
  } catch (e) {
    console.error("[listWarnings] exceção:", e);
    return [];
  }
}

export async function getWarning(id: string): Promise<WarningWithEmployee | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(WARNINGS_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("id", id)
      .maybeSingle<WarningJoinRow>();
    if (error || !data) return null;
    return { ...data, employee: unwrapEmployee(data.employees) } as WarningWithEmployee;
  } catch (e) {
    console.error("[getWarning] exceção:", e);
    return null;
  }
}

/**
 * Cria advertência + score_event automático.
 * Ignora `score_impact` no input — derivado de WARNING_DELTA pelo nível.
 */
export async function createWarning(
  input: Omit<WarningInsert, "score_impact">,
): Promise<ActionResult<Warning>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const delta = deltaForWarning(input.nivel as WarningNivel);
    const payload = {
      ...input,
      score_impact: delta,
      data: input.data ?? new Date().toISOString().slice(0, 10),
    };

    const { data, error } = await supabase
      .from(WARNINGS_TABLE)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao criar advertência" };
    }
    const warning = data as Warning;

    // Score event vinculado.
    if (delta !== 0) {
      await supabase.from(SCORE_EVENTS_TABLE).insert({
        employee_id: input.employee_id,
        tipo: `warning_${input.nivel}`,
        delta,
        descricao: input.descricao,
        referencia_id: warning.id,
      } as never);
    }

    revalidatePath("/pessoas/disciplina");
    revalidatePath("/pessoas/colaboradores");
    return { ok: true, data: warning };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/** Lista faltas da unit. Filtra por mês/ano se ambos vierem. */
export async function listAbsences(
  unitId: string,
  mes?: number,
  ano?: number,
): Promise<AbsenceWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    let query = supabase
      .from(ABSENCES_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("employees.unit_id", unitId)
      .order("data", { ascending: false });
    if (mes && ano) {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const lastDay = new Date(ano, mes, 0).getDate();
      const end = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      query = query.gte("data", start).lte("data", end);
    }
    const { data, error } = await query.returns<AbsenceJoinRow[]>();
    if (error) {
      console.error("[listAbsences] error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      ...row,
      employee: unwrapEmployee(row.employees),
    })) as AbsenceWithEmployee[];
  } catch (e) {
    console.error("[listAbsences] exceção:", e);
    return [];
  }
}

/** Cria falta + score_event automático (apenas se delta !== 0). */
export async function createAbsence(
  input: Omit<AbsenceInsert, "score_impact">,
): Promise<ActionResult<Absence>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const delta = deltaForAbsence(input.tipo as AbsenceTipo);
    const payload = { ...input, score_impact: delta };

    const { data, error } = await supabase
      .from(ABSENCES_TABLE)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao criar falta" };
    }
    const absence = data as Absence;

    if (delta !== 0) {
      await supabase.from(SCORE_EVENTS_TABLE).insert({
        employee_id: input.employee_id,
        tipo: `absence_${input.tipo}`,
        delta,
        descricao: input.motivo,
        referencia_id: absence.id,
      } as never);
    }

    revalidatePath("/pessoas/disciplina");
    revalidatePath("/pessoas/colaboradores");
    return { ok: true, data: absence };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/** Score atual de um colaborador (clamp 0-100). */
export async function getEmployeeScore(employeeId: string): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return 100;
    const { data, error } = await supabase
      .from(SCORE_EVENTS_TABLE)
      .select("delta")
      .eq("employee_id", employeeId);
    if (error) {
      console.error("[getEmployeeScore] error:", error.message);
      return 100;
    }
    return calcScore((data ?? []) as Array<{ delta: number }>);
  } catch (e) {
    console.error("[getEmployeeScore] exceção:", e);
    return 100;
  }
}

/**
 * Adiciona um bônus manual ao colaborador. Insere em score_events e recalcula
 * `employees.score` (clamp 0..100). Apenas RH/gestor com permissão na unit
 * via RLS (score_events aceita INSERT da role da unit).
 */
export async function addScoreBonus(
  employeeId: string,
  delta: number,
  descricao: string,
): Promise<ActionResult<ScoreEvent>> {
  try {
    if (!Number.isFinite(delta) || delta === 0) {
      return { ok: false, error: "Delta inválido" };
    }
    const trimmed = descricao.trim();
    if (!trimmed) return { ok: false, error: "Descrição obrigatória" };

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data, error } = await supabase
      .from(SCORE_EVENTS_TABLE)
      .insert({
        employee_id: employeeId,
        tipo: delta > 0 ? "bonus_manual" : "ajuste_manual",
        delta: Math.round(delta),
        descricao: trimmed,
      } as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };

    // recalcula employees.score (lazy import pra evitar ciclo)
    const { recalcEmployeeScore } = await import("@/lib/pessoas/score-monthly");
    await recalcEmployeeScore(employeeId);

    revalidatePath("/pessoas/disciplina");
    revalidatePath(`/pessoas/colaboradores/${employeeId}`);
    return { ok: true, data: data as ScoreEvent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/** Histórico de score events de um colaborador (timeline). */
export async function listScoreEvents(employeeId: string): Promise<ScoreEvent[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(SCORE_EVENTS_TABLE)
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[listScoreEvents] error:", error.message);
      return [];
    }
    return (data ?? []) as ScoreEvent[];
  } catch (e) {
    console.error("[listScoreEvents] exceção:", e);
    return [];
  }
}

/**
 * Score de TODOS os colaboradores da unit (1 query agregada).
 * Pra `Score Geral` tab — evita N queries.
 */
export async function listEmployeeScores(unitId: string): Promise<EmployeeScore[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data: emps, error: empErr } = await supabase
      .from(TABLE)
      .select("id, nome, sobrenome, funcao, departamento, ativo")
      .eq("unit_id", unitId)
      .order("nome");
    if (empErr) {
      console.error("[listEmployeeScores] employees error:", empErr.message);
      return [];
    }
    const employees = (emps ?? []) as Array<EmployeeStub & { ativo: boolean }>;
    if (employees.length === 0) return [];

    const empIds = employees.map((e) => e.id);

    // 3 queries paralelas: score_events, warnings count, absences count
    const [scoresRes, warnsRes, absRes] = await Promise.all([
      supabase
        .from(SCORE_EVENTS_TABLE)
        .select("employee_id, delta")
        .in("employee_id", empIds),
      supabase
        .from(WARNINGS_TABLE)
        .select("employee_id")
        .in("employee_id", empIds),
      supabase
        .from(ABSENCES_TABLE)
        .select("employee_id")
        .in("employee_id", empIds),
    ]);

    const eventsBy: Record<string, Array<{ delta: number }>> = {};
    for (const r of (scoresRes.data ?? []) as Array<{ employee_id: string; delta: number }>) {
      (eventsBy[r.employee_id] ??= []).push({ delta: r.delta });
    }
    const warnsBy: Record<string, number> = {};
    for (const r of (warnsRes.data ?? []) as Array<{ employee_id: string }>) {
      warnsBy[r.employee_id] = (warnsBy[r.employee_id] ?? 0) + 1;
    }
    const absBy: Record<string, number> = {};
    for (const r of (absRes.data ?? []) as Array<{ employee_id: string }>) {
      absBy[r.employee_id] = (absBy[r.employee_id] ?? 0) + 1;
    }

    return employees.map((emp) => ({
      employee: emp,
      score: calcScore(eventsBy[emp.id] ?? []),
      warnings_count: warnsBy[emp.id] ?? 0,
      absences_count: absBy[emp.id] ?? 0,
    }));
  } catch (e) {
    console.error("[listEmployeeScores] exceção:", e);
    return [];
  }
}

// ── Ponto eletrônico ───────────────────────────────────────────

type PunchJoinRow = TimeClockPunch & {
  employees: EmployeeStub | EmployeeStub[] | null;
};

export type RegisterPunchInput = {
  employeeId: string;
  tipo: PunchTipo;
  latitude?: number | null;
  longitude?: number | null;
  deviceInfo?: string | null;
};

/**
 * Registra um punch (entrada/saida/intervalo). RLS aceita se o user
 * autenticado for o employee (user_id match) OU tiver role na unit.
 */
export async function registerPunch(
  input: RegisterPunchInput,
): Promise<ActionResult<TimeClockPunch>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };

    const { data, error } = await supabase
      .from(PUNCHES_TABLE)
      .insert({
        employee_id: input.employeeId,
        tipo: input.tipo,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        device_info: input.deviceInfo ?? null,
        timestamp_punch: new Date().toISOString(),
      } as never)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao registrar ponto" };
    }
    revalidatePath("/pessoas/ponto");
    revalidatePath("/ponto");
    return { ok: true, data: data as TimeClockPunch };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/** Punches de um colaborador no dia (todos os tipos, ordem cronológica). */
export async function getTodayPunches(employeeId: string): Promise<TimeClockPunch[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    const { data, error } = await supabase
      .from(PUNCHES_TABLE)
      .select("*")
      .eq("employee_id", employeeId)
      .gte("timestamp_punch", start)
      .lt("timestamp_punch", end)
      .order("timestamp_punch", { ascending: true });
    if (error) {
      console.error("[getTodayPunches] error:", error.message);
      return [];
    }
    return (data ?? []) as TimeClockPunch[];
  } catch (e) {
    console.error("[getTodayPunches] exceção:", e);
    return [];
  }
}

/** Punches do dia inteiro pra todos colaboradores da unit (view do GM). */
export async function listPunchesByDay(
  unitId: string,
  dataIso: string,
): Promise<PunchWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const start = `${dataIso}T00:00:00Z`;
    const end = `${dataIso}T23:59:59.999Z`;
    const { data, error } = await supabase
      .from(PUNCHES_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("employees.unit_id", unitId)
      .gte("timestamp_punch", start)
      .lte("timestamp_punch", end)
      .order("timestamp_punch", { ascending: true })
      .returns<PunchJoinRow[]>();
    if (error) {
      console.error("[listPunchesByDay] error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => {
      const emp = Array.isArray(row.employees) ? row.employees[0] ?? null : row.employees;
      return { ...row, employee: emp ?? null } as PunchWithEmployee;
    });
  } catch (e) {
    console.error("[listPunchesByDay] exceção:", e);
    return [];
  }
}

async function setPunchApproval(
  id: string,
  aprovado: boolean,
): Promise<ActionResult<TimeClockPunch>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(PUNCHES_TABLE)
      .update({ aprovado } as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao atualizar status" };
    }
    revalidatePath("/pessoas/ponto");
    return { ok: true, data: data as TimeClockPunch };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

export async function approvePunch(id: string): Promise<ActionResult<TimeClockPunch>> {
  return setPunchApproval(id, true);
}

export async function rejectPunch(id: string): Promise<ActionResult<TimeClockPunch>> {
  return setPunchApproval(id, false);
}

/** Aprova todos os punches pendentes (aprovado IS NULL) da unit num dia. */
export async function approveAllPendingPunches(
  unitId: string,
  dataIso: string,
): Promise<ActionResult<{ count: number }>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    // Postgrest não suporta filtro por employees.unit_id em UPDATE direto.
    // Buscar IDs primeiro (já filtrados via join), depois update IN.
    const punches = await listPunchesByDay(unitId, dataIso);
    const pendingIds = punches.filter((p) => p.aprovado === null).map((p) => p.id);
    if (pendingIds.length === 0) return { ok: true, data: { count: 0 } };
    const { error } = await supabase
      .from(PUNCHES_TABLE)
      .update({ aprovado: true } as never)
      .in("id", pendingIds);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/pessoas/ponto");
    return { ok: true, data: { count: pendingIds.length } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

/**
 * Tokens de sessão pra seed do browser client em PWA standalone.
 *
 * Em iOS Safari PWA standalone, o storage é isolado e document.cookie
 * pode não expor as cookies de auth ao JavaScript do client. O server
 * lê o cookie via SSR (funciona), mas o browser client retorna null
 * em getSession(). Solução: server passa os tokens via prop, client
 * faz setSession() explícito pra seed o storage local do PWA.
 */
export async function getSessionTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token || !data.session.refresh_token) return null;
    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  } catch (e) {
    console.error("[getSessionTokens] exceção:", e);
    return null;
  }
}

/** Lookup employee pelo user_id da sessão (rota /ponto). */
export async function getMyEmployee(userId?: string): Promise<Employee | null> {
  try {
    // TEMP (mock period): usa getCurrentUser() em vez de supabase.auth.getUser()
    // para ser compatível com o mock em src/lib/auth/server.ts.
    // Usa service_role pois a sessão Supabase pode estar ausente (iOS/mock).
    // Seguro: query filtrada por user_id verificado pelo auth layer.
    const authUser = await getCurrentUser();
    if (!authUser) return null;
    const service = createServiceClient();
    if (!service) return null;
    const { data, error } = await service
      .from(TABLE)
      .select("*")
      .eq("user_id", authUser.id)      .eq("ativo", true)
      .maybeSingle();
    if (error) {
      console.error("[getMyEmployee] error:", error.message);
      return null;
    }
    return (data as Employee | null) ?? null;
  } catch (e) {
    console.error("[getMyEmployee] exceção:", e);
    return null;
  }
}

// Helpers puros (calcWorkHours, nextPunchTipo, formatters) moraram aqui mas
// foram movidos pra src/lib/pessoas/punch.ts — em arquivo "use server" todos
// os exports viram Server Actions (RPC), o que quebraria o relógio do client.

// ── Gorjetas (tips_records) ────────────────────────────────────

export async function listTipsRecords(employeeId: string): Promise<TipsRecord[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(TIPS_TABLE)
      .select("*")
      .eq("employee_id", employeeId)
      .order("periodo", { ascending: false });
    if (error) {
      console.error("[listTipsRecords]", error.message);
      return [];
    }
    return (data ?? []) as TipsRecord[];
  } catch (e) {
    console.error("[listTipsRecords] exceção:", e);
    return [];
  }
}

export async function createTipsRecord(
  input: TipsRecordInsert,
): Promise<ActionResult<TipsRecord>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(TIPS_TABLE)
      .insert(input as never)
      .select()
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Falha ao criar gorjeta" };
    }
    revalidatePath(`/pessoas/colaboradores/${input.employee_id}`);
    return { ok: true, data: data as TipsRecord };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateTipsRecord(
  id: string,
  patch: TipsRecordUpdate,
): Promise<ActionResult<TipsRecord>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(TIPS_TABLE)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    if ((data as TipsRecord).employee_id) {
      revalidatePath(`/pessoas/colaboradores/${(data as TipsRecord).employee_id}`);
    }
    return { ok: true, data: data as TipsRecord };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function deleteTipsRecord(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { error } = await supabase.from(TIPS_TABLE).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/pessoas");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/** Lista gorjetas da unit. Filtra por mês/ano se ambos vierem. */
export async function listTipsByUnit(
  unitId: string,
  mes?: number,
  ano?: number,
): Promise<TipsRecordWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    type TipsJoinRow = TipsRecord & {
      employees: EmployeeStub | EmployeeStub[] | null;
    };
    let query = supabase
      .from(TIPS_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("employees.unit_id", unitId)
      .order("periodo", { ascending: false });
    if (mes && ano) {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const end = `${ano}-${String(mes).padStart(2, "0")}-01`;
      query = query.gte("periodo", start).lte("periodo", end);
    }
    const { data, error } = await query.returns<TipsJoinRow[]>();
    if (error) {
      console.error("[listTipsByUnit] error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      ...row,
      employee: unwrapEmployee(row.employees),
    })) as TipsRecordWithEmployee[];
  } catch (e) {
    console.error("[listTipsByUnit] exceção:", e);
    return [];
  }
}

// ── Vale Transporte (transport_vouchers) ───────────────────────

export async function listTransportVouchers(
  employeeId: string,
): Promise<TransportVoucher[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(VT_TABLE)
      .select("*")
      .eq("employee_id", employeeId)
      .order("periodo", { ascending: false });
    if (error) {
      console.error("[listTransportVouchers]", error.message);
      return [];
    }
    return (data ?? []) as TransportVoucher[];
  } catch (e) {
    console.error("[listTransportVouchers] exceção:", e);
    return [];
  }
}

export async function createTransportVoucher(
  input: TransportVoucherInsert,
): Promise<ActionResult<TransportVoucher>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(VT_TABLE)
      .insert(input as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    revalidatePath(`/pessoas/colaboradores/${input.employee_id}`);
    return { ok: true, data: data as TransportVoucher };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateTransportVoucher(
  id: string,
  patch: TransportVoucherUpdate,
): Promise<ActionResult<TransportVoucher>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(VT_TABLE)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    if ((data as TransportVoucher).employee_id) {
      revalidatePath(`/pessoas/colaboradores/${(data as TransportVoucher).employee_id}`);
    }
    return { ok: true, data: data as TransportVoucher };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function deleteTransportVoucher(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { error } = await supabase.from(VT_TABLE).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/pessoas");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/** Lista vale-transportes da unit. Filtra por mês/ano se ambos vierem. */
export async function listVouchersByUnit(
  unitId: string,
  mes?: number,
  ano?: number,
): Promise<TransportVoucherWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    type VTJoinRow = TransportVoucher & {
      employees: EmployeeStub | EmployeeStub[] | null;
    };
    let query = supabase
      .from(VT_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("employees.unit_id", unitId)
      .order("periodo", { ascending: false });
    if (mes && ano) {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const end = `${ano}-${String(mes).padStart(2, "0")}-01`;
      query = query.gte("periodo", start).lte("periodo", end);
    }
    const { data, error } = await query.returns<VTJoinRow[]>();
    if (error) {
      console.error("[listVouchersByUnit] error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      ...row,
      employee: unwrapEmployee(row.employees),
    })) as TransportVoucherWithEmployee[];
  } catch (e) {
    console.error("[listVouchersByUnit] exceção:", e);
    return [];
  }
}

// ── Horas Extras (overtime_records) ────────────────────────────

export async function listOvertimeRecords(
  employeeId: string,
): Promise<OvertimeRecord[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(OT_TABLE)
      .select("*")
      .eq("employee_id", employeeId)
      .order("date", { ascending: false });
    if (error) {
      console.error("[listOvertimeRecords]", error.message);
      return [];
    }
    return (data ?? []) as OvertimeRecord[];
  } catch (e) {
    console.error("[listOvertimeRecords] exceção:", e);
    return [];
  }
}

export async function createOvertimeRecord(
  input: OvertimeRecordInsert,
): Promise<ActionResult<OvertimeRecord>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const payload = { source: "manual" as const, ...input };
    const { data, error } = await supabase
      .from(OT_TABLE)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    revalidatePath(`/pessoas/colaboradores/${input.employee_id}`);
    return { ok: true, data: data as OvertimeRecord };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateOvertimeRecord(
  id: string,
  patch: OvertimeRecordUpdate,
): Promise<ActionResult<OvertimeRecord>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(OT_TABLE)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    if ((data as OvertimeRecord).employee_id) {
      revalidatePath(`/pessoas/colaboradores/${(data as OvertimeRecord).employee_id}`);
    }
    return { ok: true, data: data as OvertimeRecord };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function deleteOvertimeRecord(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { error } = await supabase.from(OT_TABLE).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/pessoas");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/**
 * Aprovar/rejeitar HE. approverId vem do user logado via auth.uid() —
 * passa explícito pra UI poder decidir (ou pode ser null pra revogar).
 */
export async function approveOvertime(
  id: string,
  approved: boolean,
  approverId: string | null,
): Promise<ActionResult<OvertimeRecord>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(OT_TABLE)
      .update({ approved, approved_by: approverId } as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    if ((data as OvertimeRecord).employee_id) {
      revalidatePath(`/pessoas/colaboradores/${(data as OvertimeRecord).employee_id}`);
    }
    return { ok: true, data: data as OvertimeRecord };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

/** Lista HE da unit. Filtra por mês/ano se ambos vierem. */
export async function listOvertimeByUnit(
  unitId: string,
  mes?: number,
  ano?: number,
): Promise<OvertimeRecordWithEmployee[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    type OTJoinRow = OvertimeRecord & {
      employees: EmployeeStub | EmployeeStub[] | null;
    };
    let query = supabase
      .from(OT_TABLE)
      .select("*, employees!inner(id, nome, sobrenome, funcao, departamento, unit_id)")
      .eq("employees.unit_id", unitId)
      .order("date", { ascending: false });
    if (mes && ano) {
      const start = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const lastDay = new Date(ano, mes, 0).getDate();
      const end = `${ano}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      query = query.gte("date", start).lte("date", end);
    }
    const { data, error } = await query.returns<OTJoinRow[]>();
    if (error) {
      console.error("[listOvertimeByUnit] error:", error.message);
      return [];
    }
    return (data ?? []).map((row) => ({
      ...row,
      employee: unwrapEmployee(row.employees),
    })) as OvertimeRecordWithEmployee[];
  } catch (e) {
    console.error("[listOvertimeByUnit] exceção:", e);
    return [];
  }
}

// ── Férias (vacations) ─────────────────────────────────────────

export async function listVacations(
  unitIdOrEmployeeId: string,
  scope: "unit" | "employee" = "employee",
): Promise<Vacation[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const col = scope === "unit" ? "unit_id" : "employee_id";
    const { data, error } = await supabase
      .from(VAC_TABLE)
      .select("*")
      .eq(col, unitIdOrEmployeeId)
      .order("start_date", { ascending: false });
    if (error) {
      console.error("[listVacations]", error.message);
      return [];
    }
    return (data ?? []) as Vacation[];
  } catch (e) {
    console.error("[listVacations] exceção:", e);
    return [];
  }
}

export async function createVacation(
  input: VacationInsert,
): Promise<ActionResult<Vacation>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const payload = {
      ...input,
      created_by: input.created_by === "bypass" ? null : input.created_by,
    };
    const { data, error } = await supabase
      .from(VAC_TABLE)
      .insert(payload as never)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    revalidatePath(`/pessoas/colaboradores/${input.employee_id}`);
    revalidatePath(`/pessoas/ferias`);
    return { ok: true, data: data as Vacation };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateVacation(
  id: string,
  patch: VacationUpdate,
): Promise<ActionResult<Vacation>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { data, error } = await supabase
      .from(VAC_TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha" };
    if ((data as Vacation).employee_id) {
      revalidatePath(`/pessoas/colaboradores/${(data as Vacation).employee_id}`);
    }
    revalidatePath(`/pessoas/ferias`);
    return { ok: true, data: data as Vacation };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export async function updateVacationStatus(
  id: string,
  status: VacationStatus,
): Promise<ActionResult<Vacation>> {
  const r = await updateVacation(id, { status });
  if (r.ok) {
    // Best-effort notification pra created_by quando status vira aprovada
    // (em_andamento) ou rejeitada (cancelada). Se created_by IS NULL
    // (férias criada via app), não notifica — limitação conhecida.
    const v = r.data;
    if (
      v.created_by &&
      (status === "em_andamento" || status === "cancelada")
    ) {
      const titulo =
        status === "em_andamento" ? "Férias aprovada" : "Férias rejeitada";
      const mensagem = `Período: ${v.start_date} → ${v.end_date}`;
      await createNotification(
        v.created_by,
        status === "em_andamento" ? "ferias_aprovada" : "ferias_rejeitada",
        titulo,
        mensagem,
        `/pessoas/ferias`,
      );
    }
  }
  return r;
}

export async function deleteVacation(id: string): Promise<ActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: "Supabase indisponível" };
    const { error } = await supabase.from(VAC_TABLE).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/pessoas/ferias`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

// ── Banco de horas / Totvs (time_records) — read-only ──────────

export async function listTimeRecords(employeeId: string): Promise<TimeRecord[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(TIMEREC_TABLE)
      .select("*")
      .eq("employee_id", employeeId)
      .order("periodo", { ascending: false });
    if (error) {
      console.error("[listTimeRecords]", error.message);
      return [];
    }
    return (data ?? []) as TimeRecord[];
  } catch (e) {
    console.error("[listTimeRecords] exceção:", e);
    return [];
  }
}

// ── Alertas de férias ─────────────────────────────────────────

export type VacationAlertEntry = {
  id: string;
  nome: string;
  funcao: string;
  data_admissao: string;
  diasRestantes: number;   // negativo = já vencida
};

export type VacationAlerts = {
  vencidas: VacationAlertEntry[];
  vencendo30: VacationAlertEntry[];
  vencendo60: VacationAlertEntry[];
  vencendo90: VacationAlertEntry[];
};

export async function getVacationAlerts(unitId: string): Promise<VacationAlerts> {
  const empty: VacationAlerts = { vencidas: [], vencendo30: [], vencendo60: [], vencendo90: [] };
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return empty;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const MS_YEAR = 365.25 * 24 * 60 * 60 * 1000;

    const { data: empsData } = await supabase
      .from(TABLE)
      .select("id, nome, sobrenome, funcao, data_admissao")
      .eq("unit_id", unitId)
      .eq("ativo", true)
      .not("data_admissao", "is", null);

    type VacationEmployee = {
      id: string;
      nome: string;
      sobrenome: string | null;
      funcao: string | null;
      data_admissao: string;
    };
    const emps = (empsData ?? []) as VacationEmployee[];
    if (emps.length === 0) return empty;

    const { data: vacs } = await supabase
      .from(VAC_TABLE)
      .select("employee_id, start_date, end_date, status, acquisitive_period_end")
      .eq("unit_id", unitId)
      .neq("status", "cancelada");

    type VacRow = { employee_id: string; start_date: string; end_date: string; status: string; acquisitive_period_end: string | null };
    const vacsByEmployee = new Map<string, VacRow[]>();
    for (const v of (vacs ?? []) as VacRow[]) {
      if (!vacsByEmployee.has(v.employee_id)) vacsByEmployee.set(v.employee_id, []);
      vacsByEmployee.get(v.employee_id)!.push(v);
    }

    const result: VacationAlerts = { vencidas: [], vencendo30: [], vencendo60: [], vencendo90: [] };

    for (const emp of emps as Array<{ id: string; nome: string; sobrenome: string; funcao: string; data_admissao: string }>) {
      const admissao = new Date(emp.data_admissao + "T00:00:00");
      const msWorked = today.getTime() - admissao.getTime();
      const periodsCompleted = Math.floor(msWorked / MS_YEAR);
      if (periodsCompleted < 1) continue; // ainda no período aquisitivo

      // Data de vencimento da concessão = admissão + (periodsCompleted + 1) * ano
      const concessaoEnd = new Date(admissao.getTime() + (periodsCompleted + 1) * MS_YEAR);
      const diasRestantes = Math.round((concessaoEnd.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

      // Verifica se já tem férias alocadas cobrindo o período atual
      const empVacs = vacsByEmployee.get(emp.id) ?? [];
      const periodStart = new Date(admissao.getTime() + periodsCompleted * MS_YEAR);
      const hasCoverage = empVacs.some((v) => {
        const startD = new Date(v.start_date + "T00:00:00");
        return startD >= periodStart;
      });
      if (hasCoverage) continue;

      const entry: VacationAlertEntry = {
        id: emp.id,
        nome: `${emp.nome} ${emp.sobrenome}`.trim(),
        funcao: emp.funcao,
        data_admissao: emp.data_admissao,
        diasRestantes,
      };

      if (diasRestantes < 0) result.vencidas.push(entry);
      else if (diasRestantes <= 30) result.vencendo30.push(entry);
      else if (diasRestantes <= 60) result.vencendo60.push(entry);
      else if (diasRestantes <= 90) result.vencendo90.push(entry);
    }

    return result;
  } catch (e) {
    console.error("[getVacationAlerts] exceção:", e);
    return empty;
  }
}

// ── Banco de horas por unidade ────────────────────────────────

export type BancoHorasEntry = {
  employee_id: string;
  nome: string;
  funcao: string;
  saldo_horas: number;
  valor_estimado: number;
  ultimo_calculo: string | null;
};

export async function getBancoHorasUnit(unitId: string): Promise<BancoHorasEntry[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    type TBRow = { id: string; employee_id: string; saldo_minutos: number; ultimo_calculo: string | null };
    type EmpRow = { id: string; nome: string; sobrenome: string; funcao: string; salario_base: string };

    const [{ data: emps }, { data: balances }] = await Promise.all([
      supabase
        .from(TABLE)
        .select("id, nome, sobrenome, funcao, salario_base")
        .eq("unit_id", unitId)
        .eq("ativo", true),
      supabase
        .from("time_bank_balance")
        .select("id, employee_id, saldo_minutos, ultimo_calculo"),
    ]);

    if (!emps?.length) return [];

    const balanceMap = new Map<string, TBRow>(
      ((balances ?? []) as TBRow[]).map((b) => [b.employee_id, b]),
    );

    return (emps as EmpRow[]).map((e) => {
      const bal = balanceMap.get(e.id);
      const saldo_horas = bal ? bal.saldo_minutos / 60 : 0;
      const salario = parseFloat(e.salario_base) || 0;
      const valor_hora = salario / 220;
      return {
        employee_id: e.id,
        nome: `${e.nome} ${e.sobrenome}`.trim(),
        funcao: e.funcao,
        saldo_horas: Math.round(saldo_horas * 10) / 10,
        valor_estimado: Math.round(valor_hora * Math.abs(saldo_horas) * 100) / 100,
        ultimo_calculo: bal?.ultimo_calculo ?? null,
      };
    }).filter((e) => e.saldo_horas !== 0);
  } catch (e) {
    console.error("[getBancoHorasUnit] exceção:", e);
    return [];
  }
}

// ── Onboarding (Vincular Conta) ────────────────────────────────

export async function vincularColaborador(
  employeeId: string,
  email: string
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser()
    const service = createServiceClient()
    if (!service) return { ok: false, error: 'Supabase indisponível' }

    // 1. Verifica se employee existe e pertence à unidade do user
    const { data, error: empError } = await service
      .from('employees')
      .select('id, nome, user_id, unit_id')
      .eq('id', employeeId)
      .single()

    const emp = data as any

    if (empError || !emp)
      return { ok: false, error: 'Colaborador não encontrado' }

    if (emp.user_id)
      return { ok: false, error: 'Colaborador já possui conta vinculada' }

    // 2. Envia magic link via Supabase Admin
    const { error: inviteError } = await service.auth.admin
      .inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?employee_id=${employeeId}`,
        data: { employee_id: employeeId }
      })

    if (inviteError)
      return { ok: false, error: inviteError.message }

    return { ok: true, data: undefined }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
