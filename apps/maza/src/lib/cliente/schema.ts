// Schemas zod do módulo Cliente / CRM.
import { z } from "zod";

const ORIGEM_VALUES = [
  "indicacao",
  "site",
  "instagram",
  "whatsapp",
  "evento",
  "outro",
] as const;

const INTERACTION_VALUES = [
  "ligacao",
  "email",
  "whatsapp",
  "reuniao",
  "visita",
  "outro",
] as const;

export const clientSchema = z.object({
  brand_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  nome: z.string().trim().min(1, "Nome obrigatório").max(160),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .nullable()
    .optional()
    .or(z.literal("")),
  telefone: z.string().trim().max(40).nullable().optional(),
  empresa: z.string().trim().max(160).nullable().optional(),
  origem: z.enum(ORIGEM_VALUES).nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
  ativo: z.boolean().optional(),
});
export type ClientFormValues = z.infer<typeof clientSchema>;

export const clientUpdateSchema = clientSchema.partial().omit({
  brand_id: true,
  unit_id: true,
});
export type ClientUpdateValues = z.infer<typeof clientUpdateSchema>;

export const interactionSchema = z.object({
  client_id: z.string().uuid(),
  tipo: z.enum(INTERACTION_VALUES),
  descricao: z.string().trim().max(2000).nullable().optional(),
  // ISO datetime "YYYY-MM-DDTHH:mm" (datetime-local) ou ISO completo.
  data: z.string().min(10),
});
export type InteractionFormValues = z.infer<typeof interactionSchema>;
