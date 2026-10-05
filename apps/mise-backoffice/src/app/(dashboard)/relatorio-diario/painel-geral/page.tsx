import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PERIODO_LABEL } from '@/app/api/relatorio-diario/_schema'
import { BotaoExportar } from './_components/botao-exportar'

// Tailwind class lookup — no dynamic template literals
const DESTAQUE_CLASSES: Record<string, string> = {
  alert: 'bg-alert/10 text-alert-bright',
  warn: 'bg-warn/10 text-warn-bright',
  fresh: 'bg-fresh/10 text-fresh-bright',
}

function brl(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

type Resumo = { faturamento: number; notaGeral: number | null; ocorrencias: number }
type Destaque = { texto: string; cor: 'alert' | 'warn' | 'fresh' }

function gerarDestaque(resumo: Resumo, faturamentoAnterior: number | null): Destaque {
  if (resumo.ocorrencias >= 3) return { texto: `${resumo.ocorrencias} ocorrências hoje`, cor: 'alert' }
  if (resumo.notaGeral !== null && resumo.notaGeral < 3)
    return { texto: `Nota da operação em ${resumo.notaGeral.toFixed(1)}`, cor: 'alert' }
  if (faturamentoAnterior && faturamentoAnterior > 0 && resumo.faturamento > 0 && resumo.faturamento < faturamentoAnterior * 0.85) {
    const queda = Math.round((1 - resumo.faturamento / faturamentoAnterior) * 100)
    return { texto: `Faturamento ${queda}% abaixo da semana passada`, cor: 'warn' }
  }
  if (resumo.ocorrencias > 0) return { texto: `${resumo.ocorrencias} ocorrência(s) hoje`, cor: 'warn' }
  return { texto: 'Tudo em dia', cor: 'fresh' }
}

function getStatusDot(status: string | null, dataStr: string): { cor: string; label: string } {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  if (!status) return { cor: 'bg-ink-faint', label: 'Sem relatório' }
  if (status === 'enviado' || status === 'auditado') return { cor: 'bg-fresh', label: status === 'auditado' ? 'Auditado' : 'Enviado' }
  if (dataStr === hoje) return { cor: 'bg-warn', label: 'Em aberto' }
  return { cor: 'bg-alert', label: 'Não enviado' }
}

function fmtDataPorExtenso(dataParam: string): string {
  const d = new Date(`${dataParam}T12:00:00Z`)
  const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })
  const dia = d.toLocaleDateString('pt-BR', { day: 'numeric', timeZone: 'UTC' })
  const mes = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
  return `${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)}, ${dia} de ${mes}`
}

function addDias(dataStr: string, dias: number): string {
  const d = new Date(`${dataStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

const ORDEM_UNIDADES: string[] = []

export default async function PainelGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/relatorio-diario')

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const { data: dataParamRaw } = await searchParams
  const dataParam = dataParamRaw || hoje
  const dataAnterior = addDias(dataParam, -7)

  const supabase = createServiceClient()

  const { data: unitsRaw } = await supabase.from('units').select('id, name').eq('active', true)
  const units = (unitsRaw ?? []).sort((a, b) => {
    const ia = ORDEM_UNIDADES.indexOf(a.name)
    const ib = ORDEM_UNIDADES.indexOf(b.name)
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  const unitIds = units.map(u => u.id)

  // Fetch today's relatorios, unit configs, and week-ago relatorios in parallel
  const [{ data: relatorios }, { data: unitConfigs }, { data: relatoriosAnt }] = await Promise.all([
    supabase.from('op_relatorio_diario').select('id, unit_id, status').in('unit_id', unitIds).eq('data', dataParam),
    supabase.from('op_unit_config').select('unit_id, periodos').in('unit_id', unitIds),
    supabase.from('op_relatorio_diario').select('id, unit_id').in('unit_id', unitIds).eq('data', dataAnterior),
  ])

  const relIdsHoje = (relatorios ?? []).map(r => r.id)
  const relIdsAnt = (relatoriosAnt ?? []).map(r => r.id)
  const todosRelIds = [...new Set([...relIdsHoje, ...relIdsAnt])]
  const relIdsHojeSet = new Set(relIdsHoje)

  // Fetch all financial and operational data in parallel
  const [
    periodosResult,
    avaliacoesResult,
    rhResult,
    result86,
    feedbacksResult,
  ] = await Promise.all([
    todosRelIds.length
      ? supabase.from('op_relatorio_periodo')
          .select('relatorio_id, periodo, sequencia, status, enviado_em, venda_total, taxa_servico, delivery, portaria')
          .in('relatorio_id', todosRelIds)
      : { data: null },
    relIdsHoje.length
      ? supabase.from('op_avaliacao_setor').select('relatorio_id, nota').in('relatorio_id', relIdsHoje).not('nota', 'is', null)
      : { data: null },
    relIdsHoje.length
      ? supabase.from('op_rh_ocorrencia').select('id, relatorio_id').in('relatorio_id', relIdsHoje)
      : { data: null },
    relIdsHoje.length
      ? supabase.from('op_86').select('id, relatorio_id').in('relatorio_id', relIdsHoje)
      : { data: null },
    relIdsHoje.length
      ? supabase.from('op_feedback_cliente').select('id, relatorio_id').in('relatorio_id', relIdsHoje).eq('tipo', 'reclamacao')
      : { data: null },
  ])

  const periodosDb = periodosResult.data
  const avaliacoes = avaliacoesResult.data
  const rhOcorrencias = rhResult.data
  const items86 = result86.data
  const feedbacks = feedbacksResult.data

  // Build periods map for chip display (today only) and financial data (all)
  const configMap = new Map((unitConfigs ?? []).map(c => [c.unit_id, (c.periodos as string[] | null) ?? ['almoco', 'jantar']]))
  const periodosPorRel = new Map<string, { periodo: string; sequencia: number; status: string }[]>()
  type PerRow = { relatorio_id: string; venda_total: number | null; taxa_servico: number | null; delivery: number | null; portaria: number | null; status: string | null }
  const periodosFin = new Map<string, PerRow[]>()

  for (const p of periodosDb ?? []) {
    periodosFin.set(p.relatorio_id, [...(periodosFin.get(p.relatorio_id) ?? []), p as PerRow])
    if (!relIdsHojeSet.has(p.relatorio_id)) continue
    const arr = periodosPorRel.get(p.relatorio_id) ?? []
    arr.push({
      periodo: p.periodo,
      sequencia: Number(p.sequencia ?? 1),
      status: p.enviado_em ? 'enviado' : (p.status ?? 'rascunho'),
    })
    periodosPorRel.set(p.relatorio_id, arr)
  }

  function calcFaturamento(periodos: PerRow[]): number {
    return periodos
      .filter(p => p.status !== 'nao_se_aplica')
      .reduce((s, p) => s + (p.venda_total ?? 0) + (p.taxa_servico ?? 0) + (p.delivery ?? 0) + (p.portaria ?? 0), 0)
  }

  // Avaliacoes por relatorio
  const avaliacoesByRel = new Map<string, number[]>()
  for (const a of avaliacoes ?? []) {
    if (a.nota == null) continue
    const arr = avaliacoesByRel.get(a.relatorio_id) ?? []
    arr.push(a.nota as number)
    avaliacoesByRel.set(a.relatorio_id, arr)
  }

  // Ocorrências por relatorio
  const ocorrenciasByRel = new Map<string, number>()
  function addOc(relId: string) { ocorrenciasByRel.set(relId, (ocorrenciasByRel.get(relId) ?? 0) + 1) }
  for (const r of rhOcorrencias ?? []) addOc(r.relatorio_id)
  for (const r of items86 ?? []) addOc(r.relatorio_id)
  for (const r of feedbacks ?? []) addOc(r.relatorio_id)

  // Per-unit resumo (today)
  const resumoMap = new Map<string, Resumo>()
  for (const rel of relatorios ?? []) {
    const notas = avaliacoesByRel.get(rel.id) ?? []
    resumoMap.set(rel.unit_id, {
      faturamento: calcFaturamento(periodosFin.get(rel.id) ?? []),
      notaGeral: notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : null,
      ocorrencias: ocorrenciasByRel.get(rel.id) ?? 0,
    })
  }

  // Per-unit faturamento week-ago
  const fatAntMap = new Map<string, number>()
  for (const rel of relatoriosAnt ?? []) {
    fatAntMap.set(rel.unit_id, calcFaturamento(periodosFin.get(rel.id) ?? []))
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Painel Geral</h1>
          <p className="text-sm text-ink-muted capitalize">
            {fmtDataPorExtenso(dataParam)}{dataParam === hoje ? ' · Hoje' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BotaoExportar />
          <div className="flex gap-1">
            <Link
              href={`/relatorio-diario/painel-geral?data=${addDias(dataParam, -1)}`}
              className="rounded-lg border border-edge p-2 text-ink-muted hover:text-ink transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href={`/relatorio-diario/painel-geral?data=${addDias(dataParam, 1)}`}
              className="rounded-lg border border-edge p-2 text-ink-muted hover:text-ink transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {units.map(u => {
          const rel = relatorios?.find(r => r.unit_id === u.id)
          const { cor, label } = getStatusDot(rel?.status ?? null, dataParam)
          const periodosAtivos = configMap.get(u.id) ?? ['almoco', 'jantar']
          const rowsPorDia = rel ? (periodosPorRel.get(rel.id) ?? []) : []
          const resumo = rel ? resumoMap.get(u.id) : undefined
          const fatAnt = fatAntMap.get(u.id) ?? null
          const destaque = resumo ? gerarDestaque(resumo, fatAnt) : null

          const CHIP_ORDER = ['manha', 'almoco', 'jantar']
          const baseChips = periodosAtivos
            .filter(p => p !== 'eventos' && p !== 'manha')
            .map(p => ({
              periodo: p,
              sequencia: 1,
              status: rowsPorDia.find(r => r.periodo === p && r.sequencia === 1)?.status ?? 'pendente',
            }))
          const extraChips = rowsPorDia.filter(r => r.periodo === 'manha' || r.periodo === 'eventos')
          const allChips = [...baseChips, ...extraChips].sort((a, b) => {
            if (a.periodo === 'eventos' && b.periodo === 'eventos') return a.sequencia - b.sequencia
            if (a.periodo === 'eventos') return 1
            if (b.periodo === 'eventos') return -1
            const ia = CHIP_ORDER.indexOf(a.periodo)
            const ib = CHIP_ORDER.indexOf(b.periodo)
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
          })

          return (
            <Link
              key={u.id}
              href={`/relatorio-diario/${dataParam}?unit_id=${u.id}`}
              className="rounded-xl border border-edge bg-surface p-4 hover:bg-surface-raised/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">{u.name}</span>
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cor}`} />
              </div>

              {resumo && (
                <>
                  <div className="mt-3 grid grid-cols-3 divide-x divide-edge/50 border-t border-edge/50 pt-3">
                    <div className="pr-3 text-center">
                      <p className="text-xs font-semibold text-ink tabular-nums">{brl(resumo.faturamento)}</p>
                      <p className="text-[10px] text-ink-muted">Faturamento</p>
                    </div>
                    <div className="px-3 text-center">
                      <p className="text-xs font-semibold text-ink tabular-nums">
                        {resumo.notaGeral !== null ? resumo.notaGeral.toFixed(1) : '—'}
                      </p>
                      <p className="text-[10px] text-ink-muted">Nota Op.</p>
                    </div>
                    <div className="pl-3 text-center">
                      <p className="text-xs font-semibold text-ink tabular-nums">{resumo.ocorrencias}</p>
                      <p className="text-[10px] text-ink-muted">Ocorrências</p>
                    </div>
                  </div>
                  {destaque && (
                    <div className="mt-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${DESTAQUE_CLASSES[destaque.cor]}`}>
                        {destaque.texto}
                      </span>
                    </div>
                  )}
                </>
              )}

              <div className="mt-2 flex flex-wrap gap-1">
                {allChips.map(chip => {
                  const enviado = chip.status === 'enviado'
                  const na = chip.status === 'nao_se_aplica'
                  const chipLabel = chip.periodo === 'eventos'
                    ? `Evento ${chip.sequencia}`
                    : (PERIODO_LABEL[chip.periodo] ?? chip.periodo)
                  return (
                    <span
                      key={`${chip.periodo}-${chip.sequencia}`}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        enviado ? 'bg-fresh/15 text-fresh-bright' : na ? 'bg-edge/20 text-ink-faint/60' : 'bg-edge/40 text-ink-muted'
                      }`}
                    >
                      {chipLabel}
                    </span>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-ink-muted">{label}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
