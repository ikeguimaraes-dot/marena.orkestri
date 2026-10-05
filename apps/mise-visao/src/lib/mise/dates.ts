// Comparações de timestamptz (validade, printed_at) contra "agora" são
// instante-absoluto — não precisam de timezone. Só os limites de MÊS
// dependem do calendário local (Brasil, America/Sao_Paulo). O país não
// observa horário de verão desde 2019, então o offset -03:00 é fixo.
const BRAZIL_OFFSET = "-03:00";

export function nowIso(): string {
  return new Date().toISOString();
}

export function hoursFromNowIso(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function currentSaoPauloYearMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month };
}

function monthBoundsIso(year: number, month: number): { startIso: string; endIso: string } {
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00${BRAZIL_OFFSET}`);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00${BRAZIL_OFFSET}`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function currentMonthRange(): { startIso: string; endIso: string } {
  const { year, month } = currentSaoPauloYearMonth();
  return monthBoundsIso(year, month);
}

export function previousMonthRange(): { startIso: string; endIso: string } {
  const { year, month } = currentSaoPauloYearMonth();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return monthBoundsIso(prevYear, prevMonth);
}

export type LabelUrgency = "vencida" | "proxima" | "normal";

export function classifyValidade(validadeIso: string, nowMs: number): LabelUrgency {
  const validadeMs = new Date(validadeIso).getTime();
  if (validadeMs < nowMs) return "vencida";
  if (validadeMs - nowMs <= 24 * 60 * 60 * 1000) return "proxima";
  return "normal";
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** "há 2h", "em 3h", "em 5d" — tempo restante/decorrido relativo a agora. */
export function formatRemaining(validadeIso: string, nowMs: number): string {
  const diffMs = new Date(validadeIso).getTime() - nowMs;
  const past = diffMs < 0;
  const absMs = Math.abs(diffMs);

  let magnitude: string;
  if (absMs < HOUR_MS) {
    magnitude = `${Math.max(1, Math.round(absMs / 60000))}min`;
  } else if (absMs < DAY_MS) {
    magnitude = `${Math.round(absMs / HOUR_MS)}h`;
  } else {
    magnitude = `${Math.round(absMs / DAY_MS)}d`;
  }

  return past ? `há ${magnitude}` : `em ${magnitude}`;
}
