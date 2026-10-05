// Schemas zod v4 do módulo Eventos.
//
// Boundary: client form → Server Action → Supabase. O form valida com zod
// antes de submeter; a action também faz `safeParse` defensivo.

import { z } from "zod";

// ── Subitens ──────────────────────────────────────────────────

export const brigadaItemSchema = z.object({
  funcao: z.string().trim().min(1, "Função obrigatória"),
  qtd: z.number().int().min(0).max(99),
});

export const menuItemSchema = z.object({
  categoria: z.string().trim().default(""),
  servico: z.string().trim().default(""),
  hr_ini: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Hora inválida")
    .nullable()
    .optional()
    .transform((v) => v || null),
  hr_fim: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Hora inválida")
    .nullable()
    .optional()
    .transform((v) => v || null),
  descritivo: z.string().default(""),
  obs: z.string().default(""),
});

export const layoutAnexoSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number().int().nonnegative(),
  data: z.string(),  // data URL base64
});

// ── Form principal ────────────────────────────────────────────
//
// Campos obrigatórios pra ESTAR no banco: brand_id, nome, data_inicio.
// Resto é nullable. Status default 'rascunho' — fluxo: rascunho → confirmado
// → em_andamento → realizado → concluido.

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)");

const horaOpt = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:MM)")
  .optional()
  .or(z.literal(""));

export const eventFormSchema = z.object({
  // Header
  brand_id: z.string().uuid("Selecione uma marca"),
  unit_id: z.string().uuid().nullable().optional(),
  tipo: z.string().trim().optional().default(""),
  nome: z.string().trim().min(1, "Nome do evento obrigatório"),
  tema: z.string().trim().optional().default(""),
  data_inicio: isoDate,
  hora_inicio: horaOpt,
  hora_termino: horaOpt,
  num_convidados: z
    .union([z.number().int().nonnegative(), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  contato_cliente: z.string().trim().optional().default(""),
  situacao_pagamento: z.string().trim().optional().default(""),
  responsavel_comercial: z.string().trim().optional().default(""),
  responsavel_operacional: z.string().trim().optional().default(""),
  status: z.string().min(1).default("rascunho"),
  briefing_cliente: z.string().optional().default(""),

  // Brigada
  brigada: z.array(brigadaItemSchema).default([]),

  // Menus
  menu_bar: z.array(menuItemSchema).default([]),
  menu_bar_info: z.string().optional().default(""),
  menu_cozinha: z.array(menuItemSchema).default([]),
  menu_cozinha_info: z.string().optional().default(""),

  // Alertas
  campo_livre: z.string().optional().default(""),

  // Montagem
  montagem: z.string().optional().default(""),
  montagem_descricao: z.string().optional().default(""),
  layout_anexos: z.array(layoutAnexoSchema).default([]),

  // Tempos
  tempos_movimentos: z.string().optional().default(""),

  // Infraestrutura
  espacos: z.string().optional().default(""),
  acesso_entrada: z.string().optional().default(""),
  acesso_obs: z.string().optional().default(""),
  mobiliario: z.string().optional().default(""),
  mobiliario_obs: z.string().optional().default(""),
  fotografia: z.string().optional().default(""),
  valet: z.string().optional().default(""),
  artistico: z.string().optional().default(""),
  gerador: z.string().optional().default(""),
  ambulancia: z.string().optional().default(""),
  menores: z.string().optional().default(""),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;
