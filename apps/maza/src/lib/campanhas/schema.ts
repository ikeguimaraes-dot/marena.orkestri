// Schemas zod v4 do módulo Campanhas.
import { z } from "zod";

export const campaignSchema = z
  .object({
    brand_id: z.string().uuid().nullable().optional(),
    unit_id: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1, "Título obrigatório"),
    description: z.string().trim().optional().nullable(),
    image_url: z.string().trim().optional().nullable(),
    category: z.enum(["saude", "evento", "comunicado"]),
    target: z.enum(["all", "department"]).default("all"),
    target_value: z.string().trim().optional().nullable(),
    active: z.boolean().optional(),
    starts_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    ends_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
  })
  .refine(
    (v) => v.target !== "department" || (v.target_value && v.target_value.length > 0),
    {
      message: "target_value obrigatório quando target='department'",
      path: ["target_value"],
    },
  );

export type CampaignFormValues = z.infer<typeof campaignSchema>;
