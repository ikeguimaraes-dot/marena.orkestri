// Schemas zod do módulo Treinamentos.
import { z } from "zod";

const STATUS_VALUES = ["pendente", "em_andamento", "concluido", "vencido"] as const;

export const trainingTemplateSchema = z.object({
  brand_id: z.string().uuid(),
  unit_id: z.string().uuid().nullable().optional(),
  nome: z.string().trim().min(1, "Nome obrigatório").max(160),
  descricao: z.string().trim().max(2000).nullable().optional(),
  funcao: z.string().trim().max(80).nullable().optional(),
  obrigatorio: z.boolean().optional(),
  validade_dias: z.number().int().positive().nullable().optional(),
  ativo: z.boolean().optional(),
});
export type TrainingTemplateFormValues = z.infer<typeof trainingTemplateSchema>;

export const trainingTemplateUpdateSchema = trainingTemplateSchema
  .partial()
  .omit({ brand_id: true });
export type TrainingTemplateUpdateValues = z.infer<typeof trainingTemplateUpdateSchema>;

export const trainingRecordSchema = z.object({
  employee_id: z.string().uuid(),
  template_id: z.string().uuid(),
  status: z.enum(STATUS_VALUES).optional(),
  data_inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  data_conclusao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});
export type TrainingRecordFormValues = z.infer<typeof trainingRecordSchema>;

export const trainingRecordUpdateSchema = trainingRecordSchema
  .partial()
  .omit({ employee_id: true, template_id: true });
export type TrainingRecordUpdateValues = z.infer<typeof trainingRecordUpdateSchema>;
