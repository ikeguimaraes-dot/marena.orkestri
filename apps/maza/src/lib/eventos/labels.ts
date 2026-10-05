import type { EventStatus } from "@maza/db/types/database";

// Status — note que a 011 expandiu o enum event_status pra incluir
// 'confirmado' e 'realizado' (paridade HOS). Mantemos todos pra UI.
export const STATUS_LABEL: Record<EventStatus, string> = {
  rascunho: "Rascunho",
  pendente_aprovacao: "Pendente",
  aprovado: "Aprovado",
  confirmado: "Confirmado",
  em_andamento: "Em andamento",
  realizado: "Realizado",
  concluido: "Concluído",
  cancelado: "Cancelado",
} as Record<EventStatus, string>;

export const STATUS_COLORS: Record<
  EventStatus,
  { bg: string; border: string; fg: string }
> = {
  rascunho:           { bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.35)", fg: "#94A3B8" },
  pendente_aprovacao: { bg: "rgba(234,179,8,0.10)",   border: "rgba(234,179,8,0.40)",   fg: "#EAB308" },
  aprovado:           { bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.40)",   fg: "#22C55E" },
  confirmado:         { bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.40)",   fg: "#22C55E" },
  em_andamento:       { bg: "rgba(59,130,246,0.10)",  border: "rgba(59,130,246,0.40)",  fg: "#3B82F6" },
  realizado:          { bg: "rgba(212,165,116,0.10)", border: "rgba(212,165,116,0.40)", fg: "#D4A574" },
  concluido:          { bg: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.40)", fg: "#64748B" },
  cancelado:          { bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.40)",   fg: "#EF4444" },
} as Record<EventStatus, { bg: string; border: string; fg: string }>;

// ── Tipo de evento (free options do select) ──────────────────
export const TIPO_OPTIONS = [
  "Corporativo",
  "Confraternização",
  "Festa Aniversário",
  "Jantar",
  "Almoço",
  "Café da Manhã",
  "Fotografia",
  "Palestra",
  "Outro",
] as const;

export const SITUACAO_PAGAMENTO_OPTIONS = [
  "Via Financeiro Adm",
  "Via Caixa Restaurante",
] as const;

export const MONTAGEM_OPTIONS = [
  "Montagem pelo cliente",
  "Montagem pela equipe HOS",
  "Montagem compartilhada",
  "Sem montagem",
] as const;

export const MOBILIARIO_OPTIONS = ["Casa", "Locação"] as const;

export const FOTOGRAFIA_OPTIONS = [
  "Autorizado",
  "Em Aprovação",
  "Não Autorizado",
] as const;

export const VALET_OPTIONS = [
  "Contratado pelo Cliente",
  "Contratado Casa",
  "Não Contratado",
] as const;

export const ARTISTICO_OPTIONS = [
  "Pelo Cliente",
  "Pela Casa",
  "Não se aplica",
] as const;

export const GERADOR_OPTIONS = [
  "Contratado Casa",
  "Contrato Cliente",
  "Não Contratado",
] as const;

export const AMBULANCIA_OPTIONS = [
  "Não Contratado",
  "Contratado Cliente",
  "UTI",
  "Remoção",
] as const;

export const ACESSO_OPTIONS = ["Entrada Principal"] as const;

// ── Categorias de menu (bar / cozinha) ──────────────────────
export const MENU_BAR_CATEGORIAS = [
  "Menu Aberto",
  "Menu Fechado",
  "Open Bar",
] as const;

export const MENU_BAR_SERVICOS = [
  "Não Alcóolicas",
  "Alcóolicas",
  "Vinhos e Champanhes",
  "Pausa de Serviço",
  "Encerramento de Serviço",
] as const;

export const MENU_COZINHA_CATEGORIAS = [
  "Coquetel Volante",
  "Empratado",
  "Cardápio Aberto",
] as const;

export const MENU_COZINHA_SERVICOS = [
  "Entradas",
  "Saladas",
  "Principais",
  "Sobremesas",
  "Pausa de Serviço",
  "Encerramento de Serviço",
] as const;

// ── Status workflow (transições válidas) ─────────────────────
export const NEXT_STATUS: Record<EventStatus, EventStatus[]> = {
  rascunho: ["pendente_aprovacao", "confirmado", "cancelado"],
  pendente_aprovacao: ["aprovado", "confirmado", "rascunho", "cancelado"],
  aprovado: ["confirmado", "em_andamento", "cancelado"],
  confirmado: ["em_andamento", "cancelado"],
  em_andamento: ["concluido", "realizado", "cancelado"],
  realizado: ["concluido"],
  concluido: [],
  cancelado: [],
} as Record<EventStatus, EventStatus[]>;
