// Schemas zod do módulo Cardápio.
import { z } from "zod";

export const cmvItemSchema = z.object({
  brand_id: z.string().uuid("brand_id obrigatório"),
  unit_id: z.string().uuid().nullable().optional(),
  nome: z.string().trim().min(1, "Nome obrigatório").max(160),
  categoria: z.string().trim().min(1, "Categoria obrigatória").max(80),
  preco_venda: z
    .number({ message: "Preço de venda obrigatório" })
    .positive("Preço deve ser maior que zero"),
  custo_total: z
    .number()
    .nonnegative("Custo não pode ser negativo")
    .nullable()
    .optional(),
  tem_ficha_tecnica: z.boolean().optional(),
  ativo: z.boolean().optional(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

export type MenuItemFormValues = z.infer<typeof cmvItemSchema>;

export const cmvItemUpdateSchema = cmvItemSchema.partial().omit({ brand_id: true });
export type MenuItemUpdateValues = z.infer<typeof cmvItemUpdateSchema>;
