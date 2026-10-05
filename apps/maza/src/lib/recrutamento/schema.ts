// Schemas zod v4 do módulo Recrutamento.
import { z } from "zod";

export const jobOpeningSchema = z.object({
  brand_id: z.string().uuid("Selecione uma marca"),
  unit_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, "Título obrigatório"),
  description: z.string().trim().optional().nullable(),
  is_active: z.boolean().optional(),
});

export type JobOpeningFormValues = z.infer<typeof jobOpeningSchema>;

export const candidateSchema = z.object({
  job_opening_id: z.string().uuid(),
  full_name: z.string().trim().min(1, "Nome obrigatório"),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
});

export type CandidateFormValues = z.infer<typeof candidateSchema>;

export const interviewQuestionSchema = z.object({
  job_opening_id: z.string().uuid(),
  question_text: z.string().trim().min(1, "Pergunta obrigatória"),
  video_url: z.string().trim().optional().nullable(),
});

export type InterviewQuestionFormValues = z.infer<typeof interviewQuestionSchema>;

// Atualização (sem job_opening_id, sem mudar order_num por aqui — tem action própria).
export const interviewQuestionUpdateSchema = z.object({
  question_text: z.string().trim().min(1, "Pergunta obrigatória").optional(),
  video_url: z.string().trim().optional().nullable(),
});

export type InterviewQuestionUpdateValues = z.infer<typeof interviewQuestionUpdateSchema>;
