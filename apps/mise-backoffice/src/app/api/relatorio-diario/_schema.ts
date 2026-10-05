// Confirmado via introspecção Sprint 0 (2026-08-24)

export const OP_86_MOTIVOS = [
  'compra_gestao',
  'producao_planejamento',
  'fornecedor_ruptura',
  'padrao_qualidade',
  'sazonalidade',
] as const
export type Op86Motivo = typeof OP_86_MOTIVOS[number]

export const PERIODOS = ['manha', 'almoco', 'jantar', 'eventos'] as const
export type Periodo = typeof PERIODOS[number]

export const SETORES_AVALIACAO = ['Salão', 'Cozinha', 'Bar', 'Limpeza', 'Caixa', 'Portaria'] as const
export type SetorAvaliacao = typeof SETORES_AVALIACAO[number]

export const SETORES_EQUIPE = ['Salão', 'Cozinha', 'Bar', 'Limpeza', 'Caixa'] as const
export type SetorEquipe = typeof SETORES_EQUIPE[number]

// A coluna op_falta_equipe.area é um enum (op_falta_area) com valores
// distintos dos rótulos da UI. Mapas de ida e volta:
export const SETOR_EQUIPE_TO_AREA: Record<SetorEquipe, string> = {
  'Salão': 'salao',
  'Cozinha': 'cozinha_parrilla',
  'Bar': 'bar',
  'Limpeza': 'limpeza',
  'Caixa': 'caixa',
}
export const AREA_TO_SETOR_EQUIPE: Record<string, SetorEquipe> = {
  salao: 'Salão',
  cozinha_parrilla: 'Cozinha',
  bar: 'Bar',
  limpeza: 'Limpeza',
  caixa: 'Caixa',
}

// Enum real: op_feedback_categoria — valores confirmados via introspecção
export const FEEDBACK_CATEGORIAS = ['prato', 'servico', 'ambiente'] as const
export type FeedbackCategoria = typeof FEEDBACK_CATEGORIAS[number]

export const FEEDBACK_CATEGORIA_LABEL: Record<string, string> = {
  prato: 'Produto',
  servico: 'Serviço',
  ambiente: 'Ambiente',
}

export const OCORRENCIA_RH_TIPOS = [
  'falta', 'atestado', 'saida_antecipada', 'advertencia', 'contratacao', 'desligamento', 'outro',
] as const
export type OcorrenciaRhTipo = typeof OCORRENCIA_RH_TIPOS[number]

export const CONTA_ASSINADA_CATEGORIAS = [
  'Sócios', 'MKT', 'Eventos', 'Administrativo', 'Promoter', 'DJs', 'Cortesia', 'Operacional',
] as const
export type ContaAssinadaCategoria = typeof CONTA_ASSINADA_CATEGORIAS[number]

export const TEMPO_OPCOES = ['Sol', 'Nublado', 'Chuva leve', 'Chuva forte', 'Frio', 'Calor'] as const
export type TempoOpcao = typeof TEMPO_OPCOES[number]

export const PERIODO_LABEL: Record<string, string> = {
  manha: 'Manhã',
  almoco: 'Almoço',
  jantar: 'Jantar',
  eventos: 'Eventos',
}

// Nomes reais confirmados via information_schema.columns (2026-08-24).
// Portaria não tem tabela própria: campos ficam em op_relatorio_periodo.
export const SCHEMA = {
  relatorio: 'op_relatorio_diario',
  periodo: 'op_relatorio_periodo',
  op_86: 'op_86',
  enxoval: 'op_86_enxoval',
  feedback: 'op_feedback_cliente',
  rh: 'op_rh_ocorrencia',
  pendura: 'op_pendura',
  conta_assinada: 'op_assinada',
  portaria_desistencia: 'op_portaria_desistencia',
  unit_config: 'op_unit_config',
} as const
