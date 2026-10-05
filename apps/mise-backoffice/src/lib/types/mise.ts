export type Label = {
  id: string
  unit_id: string
  employee_id: string | null
  production_order_id: string | null
  ingredient_id: string | null
  menu_item_id: string | null
  tipo: 'ingrediente' | 'preparacao' | 'porcao'
  nome: string
  peso_kg: number | null
  setor: string | null
  lote: string | null
  selo: 'SIF' | 'SISP' | 'SIM' | null
  validade_fornecedor: string | null
  metodo_conservacao: string | null
  data_manipulacao: string
  validade: string
  status: 'ativa' | 'consumida' | 'descartada' | 'vencida'
  print_point_id: string | null
  printed_at: string | null
  created_at: string
}

export type PrintPoint = {
  id: string
  unit_id: string
  name: string
  rede: string | null
  ip_address: string | null
  icone: string | null
  ativo: boolean
  created_at: string
}

export type ProductionOrder = {
  id: string
  unit_id: string
  menu_item_id: string | null
  quantity: number
  unit: string
  scheduled_for: string
  assigned_to: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  notes: string | null
  created_at: string
}

export type WasteRecord = {
  id: string
  unit_id: string
  employee_id: string
  ingredient_id: string | null
  menu_item_id: string | null
  quantity: number
  unit: string
  reason: string | null
  waste_at: string
  custo_total?: number
}

export type ShelfLifeRule = {
  id: string
  categoria: string
  metodo_conservacao: string
  prazo_horas: number
}

export type UserPin = {
  id: string
  employee_id: string
  pin_hash: string
  role: 'admin' | 'gerente' | 'cozinheiro'
  created_at: string
  updated_at: string
}

export type Session = {
  id: string
  employee_id: string
  role: string
  expires_at: string
  created_at: string
}

export type ChecklistTemplate = {
  id: string
  unit_id: string | null
  nome: string
  departamento: string | null
  tipo: 'abertura' | 'fechamento' | 'rotina' | 'relatorio' | 'treinamento' | null
  ativo: boolean
  created_by: string | null
  created_at: string
}

export type ChecklistTemplateItem = {
  id: string
  template_id: string
  ordem: number
  titulo: string
  descricao: string | null
  tipo_resposta: 'sim_nao' | 'data' | 'selecao' | 'checklist_multiplo' | 'assinatura' | 'texto'
  opcoes: string[] | null
  peso: number
  exibir_na: boolean
  requer_foto: 'nunca' | 'inconformidade' | 'sempre' | 'opcional'
  requer_comentario: 'nunca' | 'opcional' | 'inconformidade'
  criar_plano_acao: 'nao' | 'sim_obrigatorio' | 'sim_opcional'
  ativo: boolean
}

export type ChecklistExecution = {
  id: string
  template_id: string
  unit_id: string
  employee_id: string | null
  status: 'em_andamento' | 'concluido'
  pontuacao_total: number
  pontuacao_obtida: number
  percentual: number
  turno: string | null
  data_execucao: string
  iniciado_em: string
  concluido_em: string | null
  created_at: string
}

export type ChecklistResponse = {
  id: string
  execution_id: string
  item_id: string
  resposta: Record<string, unknown> | null
  comentario: string | null
  foto_url: string | null
  nao_aplicavel: boolean
  created_at: string
}

export type ActionPlan = {
  id: string
  execution_id: string | null
  response_id: string | null
  item_titulo: string
  descricao: string | null
  responsavel_id: string | null
  prazo: string | null
  status: 'aberto' | 'em_andamento' | 'concluido'
  created_at: string
}
