export const OPERACOES = ["MEET & EAT", "MATCH POINT", "ESCRITÓRIO ADM"] as const;
export type Operacao = (typeof OPERACOES)[number];

export const CATEGORIAS = [
  "DECORAÇÃO",
  "ELÉTRICA",
  "EQUIPAMENTO",
  "HIDRÁULICA",
  "MANUTENÇÃO",
  "MARCENARIA",
  "MOBILIA",
  "PINTURA",
  "PREDIAL",
  "INVESTIMENTO",
  "SERRALHEIRO",
  "TAPEÇARIA",
  "SINALIZAÇÃO",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const LOCAIS = [
  "BAR",
  "CASA APOIO",
  "COZINHA",
  "CONFEITARIA",
  "ENTRADA",
  "ESCRITÓRIO",
  "ESTOQUE",
  "INFRA BACK",
  "LAVAGEM",
  "MEZANINO",
  "PRODUÇÃO",
  "SALÃO",
  "ESCADA",
  "VARANDA",
] as const;
export type Local = (typeof LOCAIS)[number];

export const ANDARES = ["TÉRREO", "MEIO", "ROOFTOP", "CASA TODA"] as const;
export type Andar = (typeof ANDARES)[number];

export const PRIORIDADES = ["P.0", "P.1", "P.2", "P.3", "P.5"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export const FORMAS_PAGAMENTO = [
  "A VISTA",
  "PIX",
  "BOLETO",
  "1X",
  "2X",
  "3X",
  "4X",
  "6X",
  "10X",
  "50%+50%",
  "A DEFINIR",
] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const PRIORIDADE_CORES: Record<Prioridade, { background: string; color: string }> = {
  "P.0": { background: "#7F1D1D", color: "#FCA5A5" },
  "P.1": { background: "#7C2D12", color: "#FDBA74" },
  "P.2": { background: "#78350F", color: "#FDE68A" },
  "P.3": { background: "#1E3A8A", color: "#93C5FD" },
  "P.5": { background: "var(--surface-3)", color: "var(--text-3)" },
};
