/**
 * MARENA Score Policy — Kernel de pontuação oficial
 *
 * ÚNICA fonte de verdade para as regras de teto de score.
 * Qualquer módulo, qualquer painel — todos leem o mesmo número porque
 * todos passam por esta função com os mesmos inputs.
 *
 * Regra de teto:
 *   CRITICO → score oficial máx 60
 *   ALTO    → score oficial máx 80
 *   MEDIO / BAIXO / sem risco pendente → sem teto
 *
 * Idempotente: aplicar múltiplas vezes com o mesmo input produz o mesmo resultado.
 * Sem side-effects: não escreve no banco, não chama APIs.
 */

export type Severidade = "CRITICO" | "ALTO" | "MEDIO" | "BAIXO";

/** Teto numérico por severidade. Ausência de risco ≥ ALTO → sem teto aplicado. */
export const SCORE_TETOS: Readonly<Record<"CRITICO" | "ALTO", number>> = {
  CRITICO: 60,
  ALTO:    80,
} as const;

export type ProposalRisk = {
  id: string;
  severidade: Severidade | null;
  titulo: string;
  status: string;
};

export type ScoreCapResult = {
  /** Score pós-teto — o número que todos os painéis devem exibir. */
  score_oficial: number;
  /** Razão legível do teto, ex: "Teto 60: risco CRÍTICO — Auditoria de folha ...". Null se sem teto. */
  cap_razao: string | null;
  /** True se o teto foi de fato aplicado (rawScore era maior que o teto). */
  aplicado: boolean;
};

/**
 * Tailwind color class para exibição de score.
 * Único ponto de verdade — todos os painéis devem usar esta função.
 * Verde ≥ 80 · Amarelo 60-79 · Vermelho < 60
 */
export function scoreColorClass(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

/**
 * Aplica a política de teto ao score bruto com base nos riscos pendentes do módulo.
 *
 * @param rawScore  Score calculado pelo agente (0–100).
 * @param proposals Riscos pendentes do módulo (já filtrados por status se necessário).
 */
export function applyScoreCap(
  rawScore: number,
  proposals: ProposalRisk[],
): ScoreCapResult {
  const pendentes = proposals.filter(
    (p) => p.status === "pending" || p.status === "open",
  );

  // Pior severidade primeiro: CRITICO > ALTO
  const critico = pendentes.find((p) => p.severidade === "CRITICO");
  if (critico) {
    const cap = SCORE_TETOS.CRITICO;
    return {
      score_oficial: Math.min(rawScore, cap),
      cap_razao:     `Teto ${cap}: risco CRÍTICO — ${critico.titulo}`,
      aplicado:      rawScore > cap,
    };
  }

  const alto = pendentes.find((p) => p.severidade === "ALTO");
  if (alto) {
    const cap = SCORE_TETOS.ALTO;
    return {
      score_oficial: Math.min(rawScore, cap),
      cap_razao:     `Teto ${cap}: risco ALTO — ${alto.titulo}`,
      aplicado:      rawScore > cap,
    };
  }

  return {
    score_oficial: rawScore,
    cap_razao:     null,
    aplicado:      false,
  };
}
