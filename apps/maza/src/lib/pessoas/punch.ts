// Punch helpers — funções puras (sem Supabase/React).
// Usado tanto no server (actions.ts) quanto no client (PunchButton ao vivo).
//
// IMPORTANTE: NÃO mora em actions.ts porque arquivos "use server" fazem
// todos os exports virarem Server Actions (RPC), inclusive funções puras.

export const BULK_APPROVE_MAX = 50;

import type {
  EmployeeStub,
  PunchDaySummary,
  PunchTipo,
  PunchWithEmployee,
  TimeClockPunch,
} from "@maza/db/types/pessoas";

export const PUNCH_LABEL: Record<PunchTipo, string> = {
  entrada: "Entrada",
  saida: "Saída",
  intervalo_inicio: "Início do intervalo",
  intervalo_fim: "Fim do intervalo",
};

export const PUNCH_BUTTON_LABEL: Record<PunchTipo, string> = {
  entrada: "Registrar entrada",
  intervalo_inicio: "Iniciar intervalo",
  intervalo_fim: "Retornar do intervalo",
  saida: "Registrar saída",
};

export const PUNCH_COLOR: Record<PunchTipo, string> = {
  entrada: "#22C55E",
  intervalo_inicio: "#F59E0B",
  intervalo_fim: "#3B82F6",
  saida: "#EF4444",
};

export function calcWorkHours(punches: ReadonlyArray<TimeClockPunch>): {
  worked_minutes: number;
  break_minutes: number;
} {
  const sorted = [...punches].sort(
    (a, b) => new Date(a.timestamp_punch).getTime() - new Date(b.timestamp_punch).getTime(),
  );
  let worked = 0;
  let breakMin = 0;
  let inEntrada: number | null = null;
  let inIntervalo: number | null = null;
  const now = Date.now();

  for (const p of sorted) {
    const t = new Date(p.timestamp_punch).getTime();
    if (p.tipo === "entrada") {
      inEntrada = t;
    } else if (p.tipo === "saida") {
      if (inEntrada !== null) {
        worked += (t - inEntrada) / 60000;
        inEntrada = null;
      }
    } else if (p.tipo === "intervalo_inicio") {
      inIntervalo = t;
      if (inEntrada !== null) {
        worked += (t - inEntrada) / 60000;
        inEntrada = null;
      }
    } else if (p.tipo === "intervalo_fim") {
      if (inIntervalo !== null) {
        breakMin += (t - inIntervalo) / 60000;
        inIntervalo = null;
      }
      inEntrada = t;
    }
  }
  if (inEntrada !== null) worked += (now - inEntrada) / 60000;
  if (inIntervalo !== null) breakMin += (now - inIntervalo) / 60000;

  return {
    worked_minutes: Math.max(0, Math.round(worked)),
    break_minutes: Math.max(0, Math.round(breakMin)),
  };
}

/** Próximo tipo válido de punch dado o histórico do dia. */
export function nextPunchTipo(
  punches: ReadonlyArray<TimeClockPunch>,
): PunchTipo | null {
  const sorted = [...punches].sort(
    (a, b) => new Date(a.timestamp_punch).getTime() - new Date(b.timestamp_punch).getTime(),
  );
  const last = sorted[sorted.length - 1];
  if (!last) return "entrada";
  switch (last.tipo as PunchTipo) {
    case "entrada":
      return "intervalo_inicio";
    case "intervalo_inicio":
      return "intervalo_fim";
    case "intervalo_fim":
      return "saida";
    case "saida":
      return null;
    default:
      return "entrada";
  }
}

export function formatMinutesAsHours(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "0h00";
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function formatHHMM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Agrupa punches do dia por colaborador + calcula totais. */
export function summarizePunchesByEmployee(
  punches: ReadonlyArray<PunchWithEmployee>,
): PunchDaySummary[] {
  const byEmp = new Map<string, { stub: EmployeeStub; punches: TimeClockPunch[] }>();
  for (const p of punches) {
    if (!p.employee) continue;
    const entry = byEmp.get(p.employee.id) ?? { stub: p.employee, punches: [] };
    entry.punches.push(p as TimeClockPunch);
    byEmp.set(p.employee.id, entry);
  }
  return Array.from(byEmp.values())
    .map((e) => {
      const { worked_minutes, break_minutes } = calcWorkHours(e.punches);
      const pending = e.punches.filter((x) => x.aprovado === null).length;
      return {
        employee: e.stub,
        punches: e.punches,
        worked_minutes,
        break_minutes,
        pending_count: pending,
      };
    })
    .sort((a, b) =>
      `${a.employee.nome} ${a.employee.sobrenome}`.localeCompare(
        `${b.employee.nome} ${b.employee.sobrenome}`,
      ),
    );
}
