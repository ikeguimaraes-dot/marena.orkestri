'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, Plus, Trash2, X } from 'lucide-react'
import { PERIODO_LABEL, SETORES_AVALIACAO, SETORES_EQUIPE, SETOR_EQUIPE_TO_AREA } from '@/app/api/relatorio-diario/_schema'
import type { SetorAvaliacao, SetorEquipe, Op86Motivo, OcorrenciaRhTipo } from '@/app/api/relatorio-diario/_schema'
import { BlocoHorarios, type HorariosState } from './bloco-horarios'
import { BlocoVendas, type VendasState } from './bloco-vendas'
import { BlocoClima, type ClimaState } from './bloco-clima'
import { BlocoSetores, type AvaliacaoSetoresState } from './bloco-setores'
import { BlocoResumo } from './bloco-resumo'
import { BlocoOcorrencia, type OcorrenciaState } from './bloco-ocorrencia'
import { BlocoEquipe, type EquipeState } from './bloco-equipe'
import { CampoResponsavel } from './campo-responsavel'
import { Bloco86 } from './bloco-86'
import { BlocoFeedback } from './bloco-feedback'
import { BlocoRh } from './bloco-rh'
import { BlocoPortaria, type PortariaState } from './bloco-portaria'
import { BlocoEventoInfo, type EventoInfoState } from './bloco-evento-info'

type PeriodoRef = { periodo: string; sequencia: number }

type FormState = {
  horarios: HorariosState
  vendas: VendasState
  clima: ClimaState
  setores: AvaliacaoSetoresState
  resumo: string
  ocorrencia: OcorrenciaState
  equipe: EquipeState
  responsavel: string
  portaria: PortariaState
  evento: EventoInfoState
}

type FormErros = {
  horarios?: Partial<Record<keyof HorariosState, boolean>>
  vendas_ab?: boolean
  pax_total?: boolean
  desconto?: boolean
  taxa_servico?: boolean
  delivery?: boolean
  portaria_valor?: boolean
  perda_produto?: boolean
  resumo?: boolean
  responsavel?: boolean
  clima?: { tempo?: boolean }
  setores?: Partial<Record<SetorAvaliacao, boolean>>
  equipe?: Partial<Record<SetorEquipe, boolean>>
  evento?: boolean
}

function estadoInicial(
  row: Record<string, unknown> | undefined,
  avaliacoesPeriodo: { setor: string; nota: number | null; observacao: string | null }[] | undefined,
  faltasPeriodo: { area: string; lider_turno: string | null; houve_falta: boolean; nomes: string | null }[] | undefined,
  horariosPadrao: HorarioPadrao[],
  dataParam: string,
  periodo: string
): FormState {
  const sugestao = buscarSugestaoHorario(horariosPadrao, dataParam, periodo)
  const setoresBase = Object.fromEntries(
    SETORES_AVALIACAO.map(s => [s, { nota: null as number | null, obs: '' }])
  ) as AvaliacaoSetoresState
  for (const av of avaliacoesPeriodo ?? []) {
    if (av.setor in setoresBase) {
      setoresBase[av.setor as SetorAvaliacao] = { nota: av.nota, obs: av.observacao ?? '' }
    }
  }
  return {
    horarios: {
      abertura: String(row?.horario_abertura ?? '') || sugestao?.abertura || '',
      ultimo_cliente: String(row?.horario_ultimo_cliente ?? ''),
      fechamento: String(row?.horario_fechamento ?? '') || sugestao?.fechamento || '',
    },
    vendas: {
      vendas_ab: String(row?.venda_total ?? ''),
      alimentos: String(row?.venda_alimentos ?? ''),
      bebidas: String(row?.venda_bebidas ?? ''),
      taxa_servico: String(row?.taxa_servico ?? ''),
      desconto: String(row?.desconto ?? ''),
      delivery: String(row?.delivery ?? ''),
      portaria_valor: String(row?.portaria ?? ''),
      pax_total: String(row?.pax_total ?? ''),
      perda_produto: String(row?.perda_produto ?? ''),
    },
    clima: {
      tempo: String(row?.clima_tempo ?? ''),
      temperatura: String(row?.clima_temperatura ?? ''),
    },
    setores: setoresBase,
    resumo: String(row?.resumo_operacional ?? ''),
    ocorrencia: {
      houve: Boolean(row?.houve_ocorrencia),
      descricao: String(row?.ocorrencia_texto ?? ''),
    },
    equipe: Object.fromEntries(
      SETORES_EQUIPE.map(s => {
        const areaEnum = SETOR_EQUIPE_TO_AREA[s]
        const f = (faltasPeriodo ?? []).find(x => x.area === areaEnum)
        return [s, {
          lider: f?.lider_turno ?? '',
          houveFalta: f?.houve_falta ?? false,
          ausentes: f?.nomes ? f.nomes.split('\n').filter(Boolean) : [''],
        }]
      })
    ) as EquipeState,
    responsavel: String(row?.responsavel_preenchimento ?? ''),
    portaria: {
      reservas: row?.portaria_reservas_previstas != null ? String(row.portaria_reservas_previstas) : '',
      no_show: row?.portaria_noshow_qty != null ? String(row.portaria_noshow_qty) : '',
      passantes: row?.portaria_passantes != null ? String(row.portaria_passantes) : '',
    },
    evento: {
      nome: String(row?.evento_nome ?? ''),
      contato: String(row?.evento_contato ?? ''),
    },
  }
}

function fmtDataPorExtenso(dataParam: string): string {
  const d = new Date(`${dataParam}T12:00:00Z`)
  const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })
  const dia = d.toLocaleDateString('pt-BR', { day: 'numeric', timeZone: 'UTC' })
  const mes = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
  const ano = d.getFullYear()
  return `${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}, ${dia} de ${mes} de ${ano}`
}

type HorarioPadrao = { dia_semana: number; periodo: string; hora_abertura: string; hora_fechamento: string }

function buscarSugestaoHorario(
  horariosPadrao: HorarioPadrao[],
  dataParam: string,
  periodo: string
): { abertura: string; fechamento: string } | null {
  if (periodo === 'eventos' || periodo === 'manha') return null
  const diaSemana = new Date(`${dataParam}T12:00:00Z`).getUTCDay()
  const doDia = horariosPadrao.filter(h => h.dia_semana === diaSemana)
  // 'unico' só define QUAIS períodos ficam fixos naquele dia (buildTabs) —
  // nunca deve virar sugestão de horário pra almoço/jantar, porque a janela
  // inteira (ex: 07h-00h) não corresponde ao horário real de cada turno.
  const achado = doDia.find(h => h.periodo === periodo)
  return achado
    ? { abertura: achado.hora_abertura.slice(0, 5), fechamento: achado.hora_fechamento.slice(0, 5) }
    : null
}

function fmtHora(h: unknown): string | null {
  if (!h || typeof h !== 'string') return null
  return h.slice(0, 5)
}

function labelPeriodo(ref: PeriodoRef): string {
  if (ref.periodo === 'eventos') return `Evento ${ref.sequencia}`
  return PERIODO_LABEL[ref.periodo] ?? ref.periodo
}

function refEq(a: PeriodoRef, b: PeriodoRef) {
  return a.periodo === b.periodo && a.sequencia === b.sequencia
}

// Espinha dorsal: só o que vem da config, excluindo eventos e manha —
// os dois são sempre opt-in (adicionados por dia, pra qualquer unidade).
function buildTabs(
  periodos: Record<string, unknown>[],
  unitConfigPeriodos: string[],
  horarioPadraoDoDia: { periodo: string }[],
  unitTemHorarioConfigurado: boolean
): PeriodoRef[] {
  let base: PeriodoRef[]

  if (unitTemHorarioConfigurado) {
    const doDia = new Set(horarioPadraoDoDia.map(h => h.periodo))
    const fixos: string[] = []
    if (doDia.has('unico')) {
      fixos.push('almoco', 'jantar')
    } else {
      if (doDia.has('almoco')) fixos.push('almoco')
      if (doDia.has('jantar')) fixos.push('jantar')
    }
    if (doDia.has('manha')) fixos.push('manha')
    base = fixos.map(p => ({ periodo: p, sequencia: 1 }))
  } else {
    // Fallback: unidade sem horário cadastrado — comportamento antigo.
    base = unitConfigPeriodos
      .filter(p => p !== 'eventos' && p !== 'manha')
      .map(p => ({ periodo: p, sequencia: 1 }))
  }

  const manhaJaFixa = base.some(b => b.periodo === 'manha')
  const manhaExtra = !manhaJaFixa
    ? periodos.filter(p => p.periodo === 'manha').map(() => ({ periodo: 'manha', sequencia: 1 }))
    : []

  const eventosRows = periodos
    .filter(p => p.periodo === 'eventos')
    .sort((a, b) => Number(a.sequencia) - Number(b.sequencia))
    .map(p => ({ periodo: 'eventos', sequencia: Number(p.sequencia) }))

  const ORDER = ['manha', 'almoco', 'jantar']
  return [...manhaExtra, ...base, ...eventosRows].sort((a, b) => {
    if (a.periodo === 'eventos' && b.periodo === 'eventos') return a.sequencia - b.sequencia
    if (a.periodo === 'eventos') return 1
    if (b.periodo === 'eventos') return -1
    const ia = ORDER.indexOf(a.periodo)
    const ib = ORDER.indexOf(b.periodo)
    if (ia === -1 && ib === -1) return a.periodo.localeCompare(b.periodo)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

export function RelatorioClient({
  relatorio,
  periodos,
  unitConfigPeriodos,
  unitId,
  unitName,
  dataParam,
  role,
  feedbacks,
  avaliacoesSetor,
  desistencias,
  colaboradores,
  faltas,
  horariosPadrao,
  itens86,
  ocorrenciasRh,
}: {
  relatorio: Record<string, unknown>
  periodos: Record<string, unknown>[]
  unitConfigPeriodos: string[]
  unitId: string
  unitName: string
  dataParam: string
  role: string
  feedbacks: { id: string; tipo: string; produto: string | null; categoria: string | null; texto: string | null }[]
  avaliacoesSetor: { periodo: string; sequencia: number; setor: string; nota: number | null; observacao: string | null }[]
  desistencias: { id: string; periodo: string | null; motivo: string | null; pax_perdido: number | null }[]
  colaboradores: { id: string; nome: string; sobrenome: string | null; funcao: string | null; cpf: string | null }[]
  faltas: { periodo: string; sequencia: number; area: string; lider_turno: string | null; houve_falta: boolean; nomes: string | null }[]
  horariosPadrao: HorarioPadrao[]
  itens86: { id: string; produto_nome: string; motivo: Op86Motivo }[]
  ocorrenciasRh: { id: string; nome: string; tipo: OcorrenciaRhTipo; cpf: string | null; observacao: string | null }[]
}) {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const isHoje = dataParam === hoje
  const relatorioFechado = relatorio.status === 'enviado'

  const unitTemHorarioConfigurado = horariosPadrao.length > 0
  const diaSemanaHoje = new Date(`${dataParam}T12:00:00Z`).getUTCDay()
  const horarioPadraoDoDia = horariosPadrao.filter(h => h.dia_semana === diaSemanaHoje)
  const diaFechado = unitTemHorarioConfigurado && horarioPadraoDoDia.length === 0
  const manhaFixaHoje = unitTemHorarioConfigurado && horarioPadraoDoDia.some(h => h.periodo === 'manha')

  const tabs = buildTabs(periodos, unitConfigPeriodos, horarioPadraoDoDia, unitTemHorarioConfigurado)
  const initialTab = tabs[0] ?? { periodo: 'almoco', sequencia: 1 }

  const [periodoAtivo, setPeriodoAtivo] = useState<PeriodoRef>(initialTab)
  const [form, setForm] = useState<FormState>(() =>
    estadoInicial(
      periodos.find(p => p.periodo === initialTab.periodo && Number(p.sequencia) === initialTab.sequencia) as Record<string, unknown>,
      avaliacoesSetor.filter(a => a.periodo === initialTab.periodo && a.sequencia === initialTab.sequencia),
      faltas.filter(f => f.periodo === initialTab.periodo && f.sequencia === initialTab.sequencia),
      horariosPadrao,
      dataParam,
      initialTab.periodo
    )
  )
  const [erros, setErros] = useState<FormErros>({})
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [adicionando, setAdicionando] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const router = useRouter()

  const enviados = periodos.filter(p => p.enviado_em)

  const [naoSeAplica, setNaoSeAplica] = useState<PeriodoRef[]>(
    periodos
      .filter(p => p.status === 'nao_se_aplica')
      .map(p => ({ periodo: p.periodo as string, sequencia: Number(p.sequencia) }))
  )
  const [naOcupado, setNaOcupado] = useState<PeriodoRef | null>(null)
  const [excluindo, setExcluindo] = useState<PeriodoRef | null>(null)

  async function excluirPeriodo(ref: PeriodoRef) {
    if (!confirm(`Excluir ${labelPeriodo(ref)}? Essa ação não pode ser desfeita.`)) return
    setExcluindo(ref)
    try {
      const res = await fetch(`/api/relatorio-diario/${dataParam}/periodos/${ref.periodo}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId, sequencia: ref.sequencia }),
      })
      if (res.ok) {
        if (refEq(periodoAtivo, ref)) setPeriodoAtivo(tabs.find(t => !refEq(t, ref)) ?? tabs[0])
        router.refresh()
      } else {
        const { error } = await res.json()
        alert(error)
      }
    } finally {
      setExcluindo(null)
    }
  }

  async function toggleNaoSeAplica(ref: PeriodoRef, aplicar: boolean) {
    let motivo: string | null = null
    if (aplicar) {
      motivo = prompt('Por que este período não vai acontecer? (ex: falta de energia, feriado, etc.)')
      if (!motivo?.trim()) return
    }
    setNaOcupado(ref)
    try {
      const res = await fetch(`/api/relatorio-diario/${dataParam}/periodos/${ref.periodo}/na`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId, aplicar, sequencia: ref.sequencia, motivo }),
      })
      if (res.ok) {
        setNaoSeAplica(prev =>
          aplicar ? [...prev, ref] : prev.filter(p => !refEq(p, ref))
        )
        router.refresh()
      } else {
        const { error } = await res.json()
        alert(error)
      }
    } finally {
      setNaOcupado(null)
    }
  }

  const aplicaveis = tabs.filter(t => !naoSeAplica.some(na => refEq(na, t)))
  const progressoPct = aplicaveis.length > 0
    ? Math.round((enviados.length / aplicaveis.length) * 100)
    : 0

  const periodoAtualEnviado = periodos.some(
    p => p.periodo === periodoAtivo.periodo && Number(p.sequencia) === periodoAtivo.sequencia && p.enviado_em
  )
  const disabled = periodoAtualEnviado || relatorioFechado || role === 'cozinheiro'

  // Ao trocar de aba, recarregar estado do período
  useEffect(() => {
    setForm(estadoInicial(
      periodos.find(p => p.periodo === periodoAtivo.periodo && Number(p.sequencia) === periodoAtivo.sequencia) as Record<string, unknown>,
      avaliacoesSetor.filter(a => a.periodo === periodoAtivo.periodo && a.sequencia === periodoAtivo.sequencia),
      faltas.filter(f => f.periodo === periodoAtivo.periodo && f.sequencia === periodoAtivo.sequencia),
      horariosPadrao,
      dataParam,
      periodoAtivo.periodo
    ))
    setErros({})
  }, [periodoAtivo]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFormChange(partial: Partial<FormState>) {
    const next = { ...form, ...partial }
    setForm(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => salvarRascunho(next), 1500)
  }

  async function salvarRascunho(estado: FormState) {
    setSalvando(true)
    await fetch(`/api/relatorio-diario/${dataParam}/periodos/${periodoAtivo.periodo}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unit_id: unitId,
        sequencia: periodoAtivo.sequencia,
        horario_abertura: estado.horarios.abertura || null,
        horario_ultimo_cliente: estado.horarios.ultimo_cliente || null,
        horario_fechamento: estado.horarios.fechamento || null,
        venda_total: estado.vendas.vendas_ab ? parseFloat(estado.vendas.vendas_ab) : null,
        venda_alimentos: estado.vendas.alimentos ? parseFloat(estado.vendas.alimentos) : null,
        venda_bebidas: estado.vendas.bebidas ? parseFloat(estado.vendas.bebidas) : null,
        taxa_servico: estado.vendas.taxa_servico ? parseFloat(estado.vendas.taxa_servico) : null,
        desconto: estado.vendas.desconto ? parseFloat(estado.vendas.desconto) : null,
        delivery: estado.vendas.delivery ? parseFloat(estado.vendas.delivery) : null,
        portaria: estado.vendas.portaria_valor ? parseFloat(estado.vendas.portaria_valor) : null,
        pax_total: estado.vendas.pax_total ? parseInt(estado.vendas.pax_total) : null,
        perda_produto: estado.vendas.perda_produto ? parseFloat(estado.vendas.perda_produto) : null,
        clima_tempo: estado.clima.tempo || null,
        clima_temperatura: estado.clima.temperatura ? parseFloat(estado.clima.temperatura) : null,
        resumo_operacional: estado.resumo || null,
        houve_ocorrencia: estado.ocorrencia.houve,
        ocorrencia_texto: estado.ocorrencia.descricao || null,
        responsavel_preenchimento: estado.responsavel || null,
        setores: estado.setores,
        portaria_reservas_previstas: estado.portaria.reservas !== '' ? parseInt(estado.portaria.reservas) : null,
        portaria_noshow_qty: estado.portaria.no_show !== '' ? parseInt(estado.portaria.no_show) : null,
        portaria_passantes: estado.portaria.passantes !== '' ? parseInt(estado.portaria.passantes) : null,
        evento_nome: estado.evento.nome || null,
        evento_contato: estado.evento.contato || null,
        equipe: SETORES_EQUIPE.map(s => ({
          area: SETOR_EQUIPE_TO_AREA[s],
          lider_turno: estado.equipe[s].lider || null,
          houve_falta: estado.equipe[s].houveFalta,
          nomes: estado.equipe[s].houveFalta
            ? estado.equipe[s].ausentes.filter(Boolean).join('\n') || null
            : null,
        })),
      }),
    })
    setSalvando(false)
  }

  function validar(estado: FormState): { valido: boolean; erros: FormErros; primeiroId: string | null } {
    const e: FormErros = {}
    let primeiroId: string | null = null

    const camposVenda: [keyof typeof estado.vendas, keyof FormErros, string][] = [
      ['vendas_ab', 'vendas_ab', 'vendas_ab'],
      ['pax_total', 'pax_total', 'pax_total'],
      ['taxa_servico', 'taxa_servico', 'taxa_servico'],
      ['delivery', 'delivery', 'delivery'],
      ['portaria_valor', 'portaria_valor', 'portaria_valor'],
      ['perda_produto', 'perda_produto', 'perda_produto'],
    ]
    for (const [campo, chaveErro, id] of camposVenda) {
      if (estado.vendas[campo] === '') { (e[chaveErro] as boolean) = true; primeiroId ??= id }
    }
    const horariosErro: FormErros['horarios'] = {}
    const camposHorario: (keyof HorariosState)[] = ['abertura', 'ultimo_cliente', 'fechamento']
    for (const campo of camposHorario) {
      if (!estado.horarios[campo].trim()) {
        horariosErro[campo] = true
        primeiroId ??= `horario-${campo}`
      }
    }
    if (Object.keys(horariosErro).length) e.horarios = horariosErro
    if (!estado.clima.tempo) { e.clima = { tempo: true }; primeiroId ??= 'clima-tempo' }
    if (!estado.resumo.trim()) { e.resumo = true; primeiroId ??= 'resumo_operacional' }
    if (!estado.responsavel.trim()) { e.responsavel = true; primeiroId ??= 'responsavel_preenchimento' }
    if (periodoAtivo.periodo === 'eventos' && !estado.evento.nome.trim()) {
      e.evento = true
      primeiroId ??= 'evento_nome'
    }

    const setoresErro: FormErros['setores'] = {}
    for (const setor of SETORES_AVALIACAO) {
      const av = estado.setores[setor]
      if (av.nota !== null && av.nota <= 2 && !av.obs.trim()) {
        setoresErro[setor] = true
        primeiroId ??= `setor-obs-${setor}`
      }
    }
    if (Object.keys(setoresErro).length) e.setores = setoresErro

    const equipeErro: FormErros['equipe'] = {}
    for (const setor of SETORES_EQUIPE) {
      if (!estado.equipe[setor].lider.trim()) {
        equipeErro[setor] = true
        primeiroId ??= `equipe-lider-${setor}`
      }
    }
    if (Object.keys(equipeErro).length) e.equipe = equipeErro

    return { valido: Object.keys(e).length === 0, erros: e, primeiroId }
  }

  async function handleEnviar() {
    const { valido, erros: novosErros, primeiroId } = validar(form)
    if (!valido) {
      setErros(novosErros)
      if (primeiroId) {
        document.getElementById(primeiroId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }
    setErros({})
    setEnviando(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    await salvarRascunho(form)

    const res = await fetch(`/api/relatorio-diario/${dataParam}/periodos/${periodoAtivo.periodo}/enviar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unitId, sequencia: periodoAtivo.sequencia }),
    })

    if (!res.ok) {
      const { error } = await res.json()
      alert(error)
      setEnviando(false)
      return
    }

    window.location.reload()
  }

  async function adicionarPeriodo(periodo: string) {
    setAdicionando(periodo)
    try {
      const res = await fetch(`/api/relatorio-diario/${dataParam}/periodos/${periodo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId }),
      })
      if (res.ok) {
        const { periodo: p, sequencia } = await res.json()
        setPeriodoAtivo({ periodo: p, sequencia })
        window.location.reload()
      } else {
        const { error } = await res.json()
        alert(error)
      }
    } finally {
      setAdicionando(null)
    }
  }

  const temManha = periodos.some(p => p.periodo === 'manha')

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto pb-24">
      {/* Cabeçalho */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Link href={`/relatorio-diario?unit_id=${unitId}`} className="text-ink-muted hover:text-ink transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-ink">{fmtDataPorExtenso(dataParam)}</h1>
            {isHoje && (
              <span className="rounded-full bg-ember/10 px-2 py-0.5 text-xs font-semibold text-ember">Hoje</span>
            )}
          </div>
        </div>
        <p className="pl-8 text-sm text-ink-muted">{unitName} · Relatório Diário</p>
      </div>

      {/* Progresso */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-ink-muted">
          <span>{enviados.length} de {aplicaveis.length} períodos enviados</span>
          <span>{progressoPct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface-raised overflow-hidden">
          <div className="h-full rounded-full bg-ember transition-all" style={{ width: `${progressoPct}%` }} />
        </div>
      </div>

      {/* Abas + botões de adicionar */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {tabs.map(ref => {
            const key = `${ref.periodo}-${ref.sequencia}`
            const periodoRow = periodos.find(p => p.periodo === ref.periodo && Number(p.sequencia) === ref.sequencia)
            const enviado = Boolean(periodoRow?.enviado_em)
            const na = naoSeAplica.some(n => refEq(n, ref))
            const ativo = refEq(periodoAtivo, ref)
            const ocupado = naOcupado ? refEq(naOcupado, ref) : false
            const horarioLabel = ref.periodo !== 'eventos'
              ? (() => {
                  const ab = fmtHora(periodoRow?.horario_abertura)
                  const fe = fmtHora(periodoRow?.horario_fechamento)
                  return ab && fe ? `${ab}–${fe}` : null
                })()
              : null
            return (
              <div
                key={key}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  ativo
                    ? 'bg-ember text-white'
                    : na
                    ? 'bg-surface border border-edge text-ink-faint'
                    : 'bg-surface border border-edge text-ink-muted'
                } ${ocupado ? 'opacity-50' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setPeriodoAtivo(ref)}
                  className={`flex flex-col items-start leading-tight ${!ativo ? 'hover:text-ink' : ''}`}
                >
                  <span className={`flex items-center gap-1.5 ${na && !ativo ? 'line-through' : ''}`}>
                    {labelPeriodo(ref)}
                    {enviado && <Check className="h-3.5 w-3.5 text-fresh" />}
                    {na && <span className="text-[10px] no-underline">N/A</span>}
                  </span>
                  {horarioLabel && (
                    <span className={`text-[10px] font-normal ${ativo ? 'text-white/70' : 'text-ink-faint'}`}>
                      {horarioLabel}
                    </span>
                  )}
                </button>
                {!enviado && !disabled && (
                  <button
                    type="button"
                    onClick={() => toggleNaoSeAplica(ref, !na)}
                    disabled={ocupado}
                    title={
                      na
                        ? (periodoRow?.na_motivo ? `Motivo: ${periodoRow.na_motivo}` : 'Reverter — voltar a aplicar')
                        : 'Não há este turno neste dia'
                    }
                    className={`ml-0.5 rounded p-0.5 transition-colors ${
                      ativo ? 'text-white/70 hover:text-white' : 'text-ink-faint hover:text-alert'
                    } ${na ? 'rotate-45' : ''}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {(ref.periodo === 'eventos' || (ref.periodo === 'manha' && !manhaFixaHoje)) && !enviado && !disabled && (
                  <button
                    type="button"
                    onClick={() => excluirPeriodo(ref)}
                    disabled={excluindo !== null}
                    title="Excluir este evento"
                    className={`ml-0.5 rounded p-0.5 transition-colors ${
                      ativo ? 'text-white/70 hover:text-white' : 'text-ink-faint hover:text-alert'
                    }`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {!disabled && !relatorioFechado && (
          <div className="flex gap-2">
            {!diaFechado && !temManha && (
              <button
                type="button"
                onClick={() => adicionarPeriodo('manha')}
                disabled={adicionando !== null}
                className="flex items-center gap-1 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink hover:border-ember transition-colors disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                {adicionando === 'manha' ? 'Adicionando…' : 'Café da manhã'}
              </button>
            )}
            <button
              type="button"
              onClick={() => adicionarPeriodo('eventos')}
              disabled={adicionando !== null}
              className="flex items-center gap-1 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink hover:border-ember transition-colors disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              {adicionando === 'eventos' ? 'Adicionando…' : 'Evento'}
            </button>
          </div>
        )}
      </div>

      {tabs.length === 0 && (
        <div className="rounded-xl border border-edge bg-surface p-6 text-center text-sm text-ink-muted">
          Esta unidade não funciona neste dia da semana. Se algo aconteceu mesmo assim, adicione um Evento acima.
        </div>
      )}

      {/* Formulário */}
      {tabs.length > 0 && <div className="space-y-4">
        {periodoAtivo.periodo === 'eventos' && (
          <BlocoEventoInfo
            value={form.evento}
            onChange={evento => handleFormChange({ evento })}
            disabled={disabled}
            erro={erros.evento}
          />
        )}
        <BlocoHorarios
          value={form.horarios}
          onChange={horarios => handleFormChange({ horarios })}
          disabled={disabled}
          erros={erros.horarios}
        />
        <BlocoVendas
          value={form.vendas}
          onChange={vendas => handleFormChange({ vendas })}
          disabled={disabled}
          erros={{ vendas_ab: erros.vendas_ab, pax_total: erros.pax_total, desconto: erros.desconto, taxa_servico: erros.taxa_servico, delivery: erros.delivery, portaria_valor: erros.portaria_valor, perda_produto: erros.perda_produto }}
        />
        <BlocoClima
          value={form.clima}
          onChange={clima => handleFormChange({ clima })}
          disabled={disabled}
          erros={erros.clima}
        />
        <BlocoSetores
          value={form.setores}
          onChange={setores => handleFormChange({ setores })}
          disabled={disabled}
          erros={erros.setores}
        />
        <BlocoResumo
          value={form.resumo}
          onChange={resumo => handleFormChange({ resumo })}
          disabled={disabled}
          erro={erros.resumo}
        />
        <BlocoOcorrencia
          value={form.ocorrencia}
          onChange={ocorrencia => handleFormChange({ ocorrencia })}
          disabled={disabled}
        />
        <BlocoEquipe
          value={form.equipe}
          onChange={equipe => handleFormChange({ equipe })}
          disabled={disabled}
          colaboradores={colaboradores}
          erros={erros.equipe}
        />

        {/* Registros colapsáveis */}
        <Bloco86 relatorioData={dataParam} unitId={unitId} disabled={disabled} itensIniciais={itens86} />
        <BlocoFeedback tipo="elogio" relatorioData={dataParam} unitId={unitId} disabled={disabled}
          itensIniciais={feedbacks.filter(f => f.tipo === 'elogio').map(f => ({ id: f.id, tipo: f.tipo, produto: f.produto, categoria: f.categoria, descricao: f.texto }))} />
        <BlocoFeedback tipo="reclamacao" relatorioData={dataParam} unitId={unitId} disabled={disabled}
          itensIniciais={feedbacks.filter(f => f.tipo === 'reclamacao').map(f => ({ id: f.id, tipo: f.tipo, produto: f.produto, categoria: f.categoria, descricao: f.texto }))} />
        <BlocoRh relatorioData={dataParam} unitId={unitId} disabled={disabled} colaboradores={colaboradores} itensIniciais={ocorrenciasRh} />
        <BlocoPortaria
          value={form.portaria}
          onChange={portaria => handleFormChange({ portaria })}
          relatorioData={dataParam}
          unitId={unitId}
          periodo={periodoAtivo.periodo}
          disabled={disabled}
          desistenciasIniciais={desistencias.filter(d => d.periodo === periodoAtivo.periodo).map(d => ({ id: d.id, motivo: d.motivo, pax_perdido: d.pax_perdido }))}
        />

        <CampoResponsavel
          value={form.responsavel}
          onChange={responsavel => handleFormChange({ responsavel })}
          disabled={disabled}
          erro={erros.responsavel}
        />
      </div>}

      {/* Rodapé */}
      {tabs.length > 0 && <div className="space-y-3 pt-2">
        {salvando && (
          <p className="text-center text-xs text-ink-subtle">Salvando rascunho…</p>
        )}
        {!periodoAtualEnviado && !relatorioFechado ? (
          <button
            onClick={handleEnviar}
            disabled={enviando || disabled}
            className="w-full rounded-xl bg-ember py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {enviando ? 'Enviando…' : `Enviar ${labelPeriodo(periodoAtivo)}`}
          </button>
        ) : periodoAtualEnviado ? (
          <div className="w-full rounded-xl border border-fresh/30 bg-fresh/10 py-3 text-center text-sm font-semibold text-fresh-bright">
            ✓ {labelPeriodo(periodoAtivo)} enviado
          </div>
        ) : null}
        {relatorioFechado && (
          <p className="text-center text-xs text-ink-subtle">
            Todos os períodos enviados — relatório fechado.
          </p>
        )}
      </div>}
    </div>
  )
}
