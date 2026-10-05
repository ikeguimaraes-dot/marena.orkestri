// Labor cost helpers — usados tanto em Server Actions (persistir no banco)
// quanto no client (recalcular em tempo real ao mover turno na grade).
//
// Fórmula: (salario_base / 220) * horas_trabalhadas
// 220 = jornada mensal padrão CLT (44h * ~5 semanas).

const HORAS_MES = 220;

/** Converte "HH:MM" ou "HH:MM:SS" → minutos desde 00:00. Retorna null se inválido. */
export function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Horas entre início e fim. Se fim ≤ início, assume que atravessou meia-noite
 * e adiciona 24h. Retorna 0 se inputs inválidos.
 */
export function hoursWorked(
  horaInicio: string | null | undefined,
  horaFim: string | null | undefined,
): number {
  const start = timeToMinutes(horaInicio);
  const end = timeToMinutes(horaFim);
  if (start === null || end === null) return 0;
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60;
  return diff / 60;
}

export function calculateLaborCost(
  salarioBase: string | number | null | undefined,
  horaInicio: string | null | undefined,
  horaFim: string | null | undefined,
): number {
  if (salarioBase === null || salarioBase === undefined || salarioBase === "") return 0;
  const salary = typeof salarioBase === "string" ? Number(salarioBase) : salarioBase;
  if (!Number.isFinite(salary) || salary <= 0) return 0;
  const horas = hoursWorked(horaInicio, horaFim);
  if (horas === 0) return 0;
  return (salary / HORAS_MES) * horas;
}
