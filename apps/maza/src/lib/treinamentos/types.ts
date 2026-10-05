// Tipos do módulo Treinamentos / Onboarding (migration 021).

import type {
  TrainingRecordRow,
  TrainingStatus,
  TrainingTemplateRow,
} from "@maza/db/types/database";
import type { EmployeeStub } from "@maza/db/types/pessoas";

export type { TrainingStatus };

export type TrainingTemplate = TrainingTemplateRow;
export type TrainingRecord = TrainingRecordRow;

export type TrainingTemplateWithBrand = TrainingTemplate & {
  brand_name: string | null;
  brand_color: string | null;
  unit_name: string | null;
  records_count: number;
};

export type TrainingRecordWithEmployee = TrainingRecord & {
  employee: EmployeeStub | null;
};

export type TrainingRecordWithTemplate = TrainingRecord & {
  template: Pick<
    TrainingTemplate,
    "id" | "nome" | "descricao" | "funcao" | "obrigatorio" | "validade_dias"
  > | null;
};

// Map UI.
export const STATUS_LABEL: Record<TrainingStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  vencido: "Vencido",
};

export const STATUS_COLOR: Record<TrainingStatus, { fg: string; bg: string }> = {
  pendente:    { fg: "var(--text-3)", bg: "var(--surface-2)" },
  em_andamento: { fg: "#1D4ED8", bg: "rgba(59,130,246,0.16)" },
  concluido:   { fg: "#15803D", bg: "rgba(34,197,94,0.16)" },
  vencido:     { fg: "#B91C1C", bg: "rgba(239,68,68,0.16)" },
};

/** Calcula status efetivo levando em conta validade. Vencido sobrepõe concluído. */
export function effectiveStatus(
  rec: Pick<TrainingRecord, "status" | "validade_ate">,
  todayIso = new Date().toISOString().slice(0, 10),
): TrainingStatus {
  if (rec.status === "concluido" && rec.validade_ate && rec.validade_ate < todayIso) {
    return "vencido";
  }
  return rec.status;
}
