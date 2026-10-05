// Schemas zod do módulo Avaliação de desempenho.
import { z } from "zod";

const PERIODICIDADE = ["mensal", "trimestral", "semestral", "anual"] as const;
const REVIEW_STATUS = ["rascunho", "concluida", "aprovada"] as const;
const CRITERIO_TIPO = ["nota_1_5", "sim_nao", "texto"] as const;

export const criterioSchema = z.object({
  id: z.string().min(1),
  nome: z.string().trim().min(1, "Nome do critério obrigatório").max(120),
  descricao: z.string().trim().max(500).nullable().optional(),
  peso: z.number().min(0.1).max(10),
  tipo: z.enum(CRITERIO_TIPO),
});

export const performanceTemplateSchema = z.object({
  brand_id: z.string().uuid(),
  unit_id: z.string().uuid().nullable().optional(),
  nome: z.string().trim().min(1, "Nome obrigatório").max(160),
  descricao: z.string().trim().max(2000).nullable().optional(),
  funcao: z.string().trim().max(80).nullable().optional(),
  periodicidade: z.enum(PERIODICIDADE),
  criterios: z.array(criterioSchema).default([]),
  ativo: z.boolean().optional(),
});
export type PerformanceTemplateFormValues = z.infer<
  typeof performanceTemplateSchema
>;

export const performanceTemplateUpdateSchema = performanceTemplateSchema
  .partial()
  .omit({ brand_id: true });
export type PerformanceTemplateUpdateValues = z.infer<
  typeof performanceTemplateUpdateSchema
>;

const respostaValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const performanceReviewSchema = z.object({
  employee_id: z.string().uuid(),
  template_id: z.string().uuid(),
  periodo: z.string().trim().min(1, "Período obrigatório").max(40),
  status: z.enum(REVIEW_STATUS).optional(),
  nota_geral: z.number().min(0).max(5).nullable().optional(),
  respostas: z.record(z.string(), respostaValueSchema).default({}),
  pontos_fortes: z.string().trim().max(2000).nullable().optional(),
  pontos_melhoria: z.string().trim().max(2000).nullable().optional(),
  plano_acao: z.string().trim().max(2000).nullable().optional(),
  data_avaliacao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});
export type PerformanceReviewFormValues = z.infer<
  typeof performanceReviewSchema
>;

export const performanceReviewUpdateSchema = performanceReviewSchema
  .partial()
  .omit({ employee_id: true, template_id: true });
export type PerformanceReviewUpdateValues = z.infer<
  typeof performanceReviewUpdateSchema
>;
