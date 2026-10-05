// Score & Disciplina — constantes + helpers de cálculo.
// Pure (sem Supabase/React) — usado tanto no server quanto no client.

import type { AbsenceTipo, ScoreEvent, WarningNivel } from "@maza/db/types/pessoas";

export const SCORE_BASE = 100;
export const SCORE_FLOOR = 0;
export const SCORE_CEIL = 100;

/** Score impact pra cada tipo de advertência. */
export const WARNING_DELTA: Record<WarningNivel, number> = {
  verbal: -10,
  escrita: -25,
  suspensao: -50,
};

export const WARNING_LABEL: Record<WarningNivel, string> = {
  verbal: "Verbal",
  escrita: "Escrita",
  suspensao: "Suspensão",
};

/** Score impact pra cada tipo de falta. */
export const ABSENCE_DELTA: Record<AbsenceTipo, number> = {
  injustificada: -5,
  justificada: 0,
  atestado: 0,
  falta_abono: 0,
};

export const ABSENCE_LABEL: Record<AbsenceTipo, string> = {
  injustificada: "Injustificada",
  justificada: "Justificada",
  atestado: "Atestado",
  falta_abono: "Falta abonada",
};

export function deltaForWarning(nivel: WarningNivel | string): number {
  return WARNING_DELTA[nivel as WarningNivel] ?? 0;
}

export function deltaForAbsence(tipo: AbsenceTipo | string): number {
  return ABSENCE_DELTA[tipo as AbsenceTipo] ?? 0;
}

// ── Bonificações (score positivo) ─────────────────────────────
// Cada constante é o delta padrão de um tipo de score_event.
export const SCORE_BONUS = {
  ASSIDUIDADE_MENSAL: 5,        // mês sem faltas injustificadas
  PONTUALIDADE_MENSAL: 3,       // mês com 100% pontualidade (sem punches rejeitados)
  ANIVERSARIO_ADMISSAO: 2,      // 1 ano completado no mês
  AVALIACAO_POSITIVA: 10,       // bônus manual padrão
} as const;

export const SCORE_EVENT_LABEL: Record<string, string> = {
  assiduidade_mensal: "Assiduidade mensal",
  pontualidade_mensal: "Pontualidade mensal",
  aniversario_admissao: "Aniversário de admissão",
  avaliacao_positiva: "Avaliação positiva",
  bonus_manual: "Bônus manual",
  warning: "Advertência",
  absence: "Falta",
};

/** Score atual = 100 + sum(deltas), clampado em [0, 100]. */
export function calcScore(events: ReadonlyArray<Pick<ScoreEvent, "delta">>): number {
  const sum = events.reduce((acc, e) => acc + (e.delta ?? 0), 0);
  const v = SCORE_BASE + sum;
  return Math.max(SCORE_FLOOR, Math.min(SCORE_CEIL, v));
}

export type ScoreColor = "green" | "yellow" | "red";

/** Verde > 80 · amarelo 60-80 · vermelho < 60. */
export function scoreColor(score: number): ScoreColor {
  if (score > 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

/** CSS color tokens para cada zona. */
export const SCORE_COLORS: Record<ScoreColor, { fg: string; bg: string; border: string }> = {
  green: {
    fg: "#15803D",
    bg: "rgba(34,197,94,0.16)",
    border: "rgba(34,197,94,0.36)",
  },
  yellow: {
    fg: "#A16207",
    bg: "rgba(245,158,11,0.16)",
    border: "rgba(245,158,11,0.36)",
  },
  red: {
    fg: "#B91C1C",
    bg: "rgba(239,68,68,0.16)",
    border: "rgba(239,68,68,0.36)",
  },
};
