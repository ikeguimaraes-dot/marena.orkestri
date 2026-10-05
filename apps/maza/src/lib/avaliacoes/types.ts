// Tipos do módulo Avaliação de desempenho (migration 022).

import type {
  PerformanceCriterio,
  PerformanceCriterioTipo,
  PerformancePeriodicidade,
  PerformanceReviewRow,
  PerformanceReviewStatus,
  PerformanceTemplateRow,
} from "@maza/db/types/database";
import type { EmployeeStub } from "@maza/db/types/pessoas";

export type {
  PerformanceCriterio,
  PerformanceCriterioTipo,
  PerformancePeriodicidade,
  PerformanceReviewStatus,
};

export type PerformanceTemplate = PerformanceTemplateRow;
export type PerformanceReview = PerformanceReviewRow;

export type PerformanceTemplateWithBrand = PerformanceTemplate & {
  brand_name: string | null;
  brand_color: string | null;
  unit_name: string | null;
  reviews_count: number;
};

export type PerformanceReviewWithEmployee = PerformanceReview & {
  employee: EmployeeStub | null;
  template_nome: string | null;
};

export type PerformanceReviewWithTemplate = PerformanceReview & {
  template: Pick<
    PerformanceTemplate,
    "id" | "nome" | "descricao" | "funcao" | "periodicidade" | "criterios"
  > | null;
};

// Maps UI.
export const STATUS_LABEL: Record<PerformanceReviewStatus, string> = {
  rascunho: "Rascunho",
  concluida: "Concluída",
  aprovada: "Aprovada",
};

export const STATUS_COLOR: Record<
  PerformanceReviewStatus,
  { fg: string; bg: string }
> = {
  rascunho: { fg: "var(--text-3)", bg: "var(--surface-2)" },
  concluida: { fg: "#1D4ED8", bg: "rgba(59,130,246,0.16)" },
  aprovada: { fg: "#15803D", bg: "rgba(34,197,94,0.16)" },
};

export const PERIODICIDADE_LABEL: Record<PerformancePeriodicidade, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const CRITERIO_TIPO_LABEL: Record<PerformanceCriterioTipo, string> = {
  nota_1_5: "Nota 1–5",
  sim_nao: "Sim / Não",
  texto: "Texto livre",
};

/**
 * Calcula nota_geral como média ponderada das respostas tipo 'nota_1_5'.
 * Retorna null se nenhum critério desse tipo foi respondido.
 * Critérios sim_nao e texto são ignorados na nota.
 */
export function calcNotaGeral(
  criterios: PerformanceCriterio[],
  respostas: Record<string, string | number | boolean | null | undefined>,
): number | null {
  let pesoTotal = 0;
  let somaPond = 0;
  for (const c of criterios) {
    if (c.tipo !== "nota_1_5") continue;
    const v = respostas[c.id];
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n) && n >= 1 && n <= 5) {
      somaPond += n * (c.peso || 1);
      pesoTotal += c.peso || 1;
    }
  }
  if (pesoTotal === 0) return null;
  return Math.round((somaPond / pesoTotal) * 100) / 100;
}

/** Formato BR pra nota_geral (NUMERIC vem como string do PostgREST). */
export function formatNota(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = typeof val === "string" ? Number(val) : val;
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2).replace(".", ",");
}
