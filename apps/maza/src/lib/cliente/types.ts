// Tipos do módulo Cliente / CRM (migration 020).

import type {
  ClientInteractionRow,
  ClientInteractionTipo,
  ClientOrigem,
  ClientRow,
} from "@maza/db/types/database";

export type { ClientInteractionTipo, ClientOrigem };

export type Client = ClientRow;
export type ClientInteraction = ClientInteractionRow;

export type ClientWithBrand = Client & {
  brand_name: string | null;
  brand_color: string | null;
  unit_name: string | null;
};

export type ClientInsert = {
  brand_id: string;
  unit_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  origem: ClientOrigem | null;
  observacoes: string | null;
  ativo: boolean;
};

export type ClientUpdate = Partial<Omit<ClientInsert, "brand_id" | "unit_id">>;

export type ClientInteractionInsert = {
  client_id: string;
  tipo: ClientInteractionTipo;
  descricao: string | null;
  data: string;       // ISO datetime
};

// Mapeamento UI.
export const ORIGEM_LABEL: Record<ClientOrigem, string> = {
  indicacao: "Indicação",
  site: "Site",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  evento: "Evento",
  outro: "Outro",
};

export const ORIGEM_COLOR: Record<ClientOrigem, { bg: string; fg: string }> = {
  indicacao: { bg: "rgba(34,197,94,0.16)", fg: "#15803D" },
  site:      { bg: "rgba(59,130,246,0.16)", fg: "#1D4ED8" },
  instagram: { bg: "rgba(236,72,153,0.16)", fg: "#BE185D" },
  whatsapp:  { bg: "rgba(34,197,94,0.10)", fg: "#15803D" },
  evento:    { bg: "rgba(168,85,247,0.16)", fg: "#7E22CE" },
  outro:     { bg: "var(--surface-2)", fg: "var(--text-2)" },
};

export const INTERACTION_LABEL: Record<ClientInteractionTipo, string> = {
  ligacao: "Ligação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  reuniao: "Reunião",
  visita: "Visita",
  outro: "Outro",
};
