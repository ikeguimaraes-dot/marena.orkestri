// Schemas zod do módulo Metas.
import { z } from "zod";

/** Aceita number ou string convertível em number; null/undefined passam direto. */
const numericInput = z
  .union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/), z.null()])
  .nullable()
  .optional()
  .transform((v) => {
    if (v == null || v === "") return null;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? n : null;
  });

const intInput = z
  .union([z.number().int(), z.string().regex(/^-?\d+$/), z.null()])
  .nullable()
  .optional()
  .transform((v) => {
    if (v == null || v === "") return null;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? Math.round(n) : null;
  });

export const brandTargetSchema = z.object({
  brand_id: z.string().uuid(),
  unit_id: z.string().uuid().nullable().optional(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "Período inválido (YYYY-MM)"),
  receita_meta: numericInput,
  cmv_meta_pct: numericInput,
  prime_cost_meta_pct: numericInput,
  ticket_medio_meta: numericInput,
  nps_meta: numericInput,
  headcount_meta: intInput,
  eventos_meta: intInput,
});
// `z.input` = tipo ANTES do transform (aceita string vinda de inputs).
// `z.output` (= z.infer) = tipo APÓS o transform (number | null).
export type BrandTargetFormValues = z.input<typeof brandTargetSchema>;

export const brandTargetUpdateSchema = brandTargetSchema
  .partial()
  .omit({ brand_id: true, periodo: true });
export type BrandTargetUpdateValues = z.infer<typeof brandTargetUpdateSchema>;

export const targetNoteSchema = z.object({
  target_id: z.string().uuid(),
  nota: z.string().trim().min(1, "Nota obrigatória").max(2000),
});
export type TargetNoteFormValues = z.infer<typeof targetNoteSchema>;
