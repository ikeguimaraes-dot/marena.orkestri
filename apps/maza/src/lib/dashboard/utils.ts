// Utilities compartilhados pelos componentes do Dashboard.
// Server-safe (sem lib client-only).

const TZ = "America/Sao_Paulo";

export const currencyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const currencyFullFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const numberFmt = new Intl.NumberFormat("pt-BR");

export const dateLongFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export const dateShortFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
});

export const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});

export const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const weekdayShortFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "short",
});

/** Hora atual em São Paulo (0–23) — base pra saudação e "hoje/amanhã". */
export function horaSP(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
  return parseInt(hourPart, 10);
}

export function saudacao(now: Date = new Date()): "Bom dia" | "Boa tarde" | "Boa noite" {
  const h = horaSP(now);
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Saca o "primeiro nome" de um e-mail. ike@dom.com → "Ike". */
export function nomeDoUsuario(email: string | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  if (!local) return null;
  const first = local.split(/[._+-]/)[0] ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Compara duas datas no fuso de SP — true se for o mesmo dia civil. */
function ymdInSP(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts; // "YYYY-MM-DD"
}

/**
 * Formata uma data como "Hoje 19:00", "Amanhã 20:00", "Sáb 14/06 19:00".
 * Sempre relativa ao "agora" no fuso América/SP.
 */
export function formatarDataRelativa(date: Date, now: Date = new Date()): string {
  const today = ymdInSP(now);
  const tomorrow = ymdInSP(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const target = ymdInSP(date);
  const hora = timeFmt.format(date);

  if (target === today) return `Hoje ${hora}`;
  if (target === tomorrow) return `Amanhã ${hora}`;

  const wd = weekdayShortFmt
    .format(date)
    .replace(/\.$/, "")
    .replace(/^./, (c) => c.toUpperCase());
  const data = dateShortFmt.format(date);
  return `${wd} ${data} ${hora}`;
}

/** Formata data por extenso pro header executivo. Capitaliza primeira letra. */
export function dataExtenso(now: Date = new Date()): string {
  const s = dateLongFmt.format(now);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Início do mês corrente em SP, retornado como ISO UTC. */
export function inicioDoMes(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  const y = parts.year ?? "1970";
  const m = parts.month ?? "01";
  // Constrói meia-noite de SP (UTC-3 ou UTC-2 c/ horário de verão) — uso
  // ISO sem TZ e Postgres interpreta como timestamptz já cobre os casos.
  return `${y}-${m}-01T00:00:00-03:00`;
}

/** Início do mês anterior em SP. */
export function inicioDoMesAnterior(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  let y = parseInt(parts.year ?? "1970", 10);
  let m = parseInt(parts.month ?? "1", 10) - 1; // mês anterior
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}-01T00:00:00-03:00`;
}

export function variacaoPct(
  atual: number,
  anterior: number,
): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return ((atual - anterior) / anterior) * 100;
}
