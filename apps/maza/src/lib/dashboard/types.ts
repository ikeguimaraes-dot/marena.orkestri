import type {
  AlertaRow,
  EventosKpiRow,
  HeadcountMarcaRow,
  ProximoEventoRow,
} from "@maza/db/types/database";

export type KpiMesAtual = {
  brand_id: string;
  brand_slug: string;
  brand_name: string;
  brand_color: string;
  mes_atual: EventosKpiRow | null;
  mes_anterior: EventosKpiRow | null;
  /** null quando mês anterior é zero (variação não definida). */
  variacao_receita_pct: number | null;
};

export type HeadcountResumo = {
  por_marca: HeadcountMarcaRow[];
  total: {
    headcount_ativo: number;
    folha_bruta: number;
    admissoes_mes: number;
    demissoes_mes: number;
  };
};

export type ProximosEventos = ProximoEventoRow[];

export type Alertas = AlertaRow[];

export type ResumoGrupo = {
  total_marcas_ativas: number;
  total_eventos_mes: number;
  receita_prevista_mes: number;
  receita_realizada_mes: number;
  /** Label do período do DRE quando diferente do mês atual (ex: "abr/26"). */
  receita_dre_label?: string;
  headcount_total: number;
  folha_bruta_total: number;
  eventos_proximos_7d: number;
  alertas_criticos: number;
};
