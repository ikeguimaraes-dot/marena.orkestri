/**
 * MARENA Score Policy — Kernel de pontuação oficial
 *
 * Política compartilhada de score da Marena.
 * Qualquer alteração nas regras de teto DEVE ser replicada nos dois arquivos.
 *
 * Regra de teto:
 *   CRITICO → score oficial máx 60
 *   ALTO    → score oficial máx 80
 *   MEDIO / BAIXO / sem risco pendente → sem teto
 */

export type Severidade = "CRITICO" | "ALTO" | "MEDIO" | "BAIXO";

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
  score_oficial: number;
  cap_razao: string | null;
  aplicado: boolean;
};

export function applyScoreCap(
  rawScore: number,
  proposals: ProposalRisk[],
): ScoreCapResult {
  const pendentes = proposals.filter(
    (p) => p.status === "pending" || p.status === "open",
  );

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
