// Tipos do módulo Eventos.
//
// A migration 011_events_expand.sql adicionou 27 colunas operacionais à
// tabela `events` (criada na 008_events.sql). Database<T> em
// `types/database.ts` ainda não foi atualizado — então tipamos aqui e
// usamos `as never` em .insert/.update + cast em .select.

import type { EventStatus } from "@maza/db/types/database";

// ── Subitens JSONB ────────────────────────────────────────────

export type BrigadaItem = {
  funcao: string;
  qtd: number;
};

export type MenuItem = {
  categoria: string;            // "Menu Aberto" | "Coquetel Volante" | etc
  servico: string;              // "Não Alcóolicas" | "Entradas" | "_info" (texto livre)
  hr_ini: string | null;
  hr_fim: string | null;
  descritivo: string;
  obs: string;
};

// Anexo armazenado como base64 — mantém compat com HOS legado. V2 deve mover
// pro Supabase Storage e guardar só o storage_path.
export type LayoutAnexo = {
  name: string;
  type: string;                 // "application/pdf" | "image/png" | etc
  size: number;
  data: string;                 // data URL (base64)
};

// ── Linha completa do evento ──────────────────────────────────

export type EventFull = {
  // Base (008_events.sql)
  id: string;
  group_id: string;
  brand_id: string;
  unit_id: string | null;
  nome: string;
  tipo: string | null;
  data_inicio: string;          // TIMESTAMPTZ ISO — combina f-data-inicio + hora_inicio
  data_fim: string | null;      // TIMESTAMPTZ ISO — data + hora_termino
  num_convidados: number | null;
  responsavel_interno: string | null;
  contato_cliente: string | null;
  telefone_cliente: string | null;
  email_cliente: string | null;
  empresa_cliente: string | null;
  observacoes: string | null;
  status: EventStatus;
  valor_total: string | null;
  valor_sinal: string | null;
  valor_sinal_pago: boolean;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;

  // Expansão (011_events_expand.sql)
  tema: string | null;
  hora_inicio: string | null;            // TIME — "HH:MM"
  hora_termino: string | null;
  situacao_pagamento: string | null;
  responsavel_comercial: string | null;
  responsavel_operacional: string | null;
  briefing_cliente: string | null;
  brigada: BrigadaItem[] | null;         // JSONB
  menu_bar: MenuItem[] | null;
  menu_cozinha: MenuItem[] | null;
  campo_livre: string | null;
  montagem: string | null;
  montagem_descricao: string | null;
  tempos_movimentos: string | null;
  espacos: string | null;
  acesso_entrada: string | null;
  acesso_obs: string | null;
  mobiliario: string | null;
  mobiliario_obs: string | null;
  fotografia: string | null;
  valet: string | null;
  artistico: string | null;
  gerador: string | null;
  ambulancia: string | null;
  menores: string | null;
  layout_anexos: LayoutAnexo[] | null;
  criado_por_nome: string | null;
};

// ── Linha enriquecida pra listagem (com nome da brand/unit via join) ──
export type EventListRow = EventFull & {
  brand_name: string | null;
  brand_color: string | null;
  unit_name: string | null;
};

// ── Histórico de status ───────────────────────────────────────
export type EventStatusLogEntry = {
  id: string;
  status_anterior: EventStatus | null;
  status_novo: EventStatus;
  motivo: string | null;
  changed_by: string | null;
  created_at: string;
};

// ── Detail bundle ─────────────────────────────────────────────
export type EventDetailData = {
  event: EventListRow;
  status_log: EventStatusLogEntry[];
};

// ── Options pra selects ───────────────────────────────────────
export type BrandOption = {
  id: string;
  name: string;
  slug: string;
  color: string;
  group_id: string | null;
};

export type UnitOption = {
  id: string;
  name: string;
  brand_id: string;
};
