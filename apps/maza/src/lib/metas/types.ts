// Tipos do módulo Metas por marca (migration 023).

import type { BrandTargetRow, TargetNoteRow } from "@maza/db/types/database";

export type BrandTarget = BrandTargetRow;
export type TargetNote = TargetNoteRow;

/** Realizado pra um período (snapshot agregado das views existentes). */
export type RealizadoSnapshot = {
  receita_realizada: number | null;       // R$ — vem de v_dre_consolidado.receita_bruta
  cmv_pct: number | null;                  // % — v_dre_consolidado.cmv_pct
  prime_cost_pct: number | null;           // % — v_dre_consolidado.prime_cost_pct
  ticket_medio: number | null;             // — sem fonte ainda; null
  nps: number | null;                      // — sem fonte ainda; null
  headcount: number | null;                // — v_headcount_por_marca.headcount_ativo (estado atual)
  eventos: number | null;                  // — v_eventos_kpi.total_eventos
};

/** Linha consolidada da listagem de metas: meta + realizado por brand. */
export type BrandTargetWithRealizado = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_color: string | null;
  periodo: string;
  target: BrandTarget | null;
  realizado: RealizadoSnapshot;
};

export type SemaforoStatus = "ok" | "alerta" | "ruim" | "sem_dados";

/** Direção do KPI: maior é melhor (receita, headcount, etc.) ou menor é melhor (CMV%, prime cost%). */
export type KpiDirection = "higher_better" | "lower_better";

export const SEMAFORO_COLOR: Record<SemaforoStatus, { fg: string; bg: string }> = {
  ok:       { fg: "#15803D", bg: "rgba(34,197,94,0.16)" },
  alerta:   { fg: "#A16207", bg: "rgba(245,158,11,0.18)" },
  ruim:     { fg: "#B91C1C", bg: "rgba(239,68,68,0.16)" },
  sem_dados:{ fg: "var(--text-3)", bg: "var(--surface-2)" },
};

/**
 * Classifica uma meta vs realizado em semáforo.
 * - higher_better (receita, ticket, NPS, headcount, eventos):
 *     >= 100% ok · >= 80% alerta · < 80% ruim
 * - lower_better (CMV%, prime cost%):
 *     realizado <= meta ok · até +5pp alerta · mais ruim
 *     Quando lower_better, comparar absoluto, não percentual.
 */
export function classifySemaforo(
  meta: number | null | undefined,
  realizado: number | null | undefined,
  direction: KpiDirection,
): SemaforoStatus {
  if (meta == null || realizado == null) return "sem_dados";
  if (direction === "higher_better") {
    if (meta === 0) return realizado >= 0 ? "ok" : "ruim";
    const pct = (realizado / meta) * 100;
    if (pct >= 100) return "ok";
    if (pct >= 80) return "alerta";
    return "ruim";
  }
  // lower_better: realizado <= meta é bom
  if (realizado <= meta) return "ok";
  if (realizado - meta <= 5) return "alerta";
  return "ruim";
}

/** % de atingimento (só pra higher_better). Retorna null se sem dados. */
export function pctAtingimento(
  meta: number | null | undefined,
  realizado: number | null | undefined,
): number | null {
  if (meta == null || realizado == null || meta === 0) return null;
  return Math.round((realizado / meta) * 100);
}

/** "2026-04" → "2026-04-01" (DATE format). */
export function periodoToDate(periodo: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(periodo)) return null;
  return `${periodo}-01`;
}

/** YYYY-MM do mês corrente. */
export function currentPeriodo(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-04" → "2026-03". Wrap em Janeiro. */
export function previousPeriodo(periodo: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return periodo;
  let y = Number(m[1]);
  let mo = Number(m[2]) - 1;
  if (mo === 0) {
    mo = 12;
    y -= 1;
  }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/** Lista de N períodos atrás incluindo o atual. Mais antigo primeiro. */
export function lastNPeriodos(n: number, fromPeriodo?: string): string[] {
  const result: string[] = [];
  let p = fromPeriodo ?? currentPeriodo();
  for (let i = 0; i < n; i++) {
    result.unshift(p);
    p = previousPeriodo(p);
  }
  return result;
}

/** Format BR pra valores monetários NUMERIC (vêm como string do PostgREST). */
export function formatBRL(val: string | number | null | undefined): string {
  if (val == null || val === "") return "—";
  const n = typeof val === "string" ? Number(val) : val;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function formatPct(val: string | number | null | undefined): string {
  if (val == null || val === "") return "—";
  const n = typeof val === "string" ? Number(val) : val;
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1).replace(".", ",")}%`;
}

export function toNumber(
  val: string | number | null | undefined,
): number | null {
  if (val == null || val === "") return null;
  const n = typeof val === "string" ? Number(val) : val;
  return Number.isFinite(n) ? n : null;
}
