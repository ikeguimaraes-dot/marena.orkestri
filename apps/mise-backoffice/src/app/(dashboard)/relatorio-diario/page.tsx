import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { PERIODO_LABEL } from '@/app/api/relatorio-diario/_schema'

function getStatusDot(status: string, dataStr: string): { cor: string; label: string } {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  if (status === 'enviado' || status === 'auditado') return { cor: 'bg-fresh', label: status === 'auditado' ? 'Auditado' : 'Enviado' }
  if (dataStr === hoje) return { cor: 'bg-warn', label: 'Em aberto' }
  return { cor: 'bg-alert', label: 'Não enviado' }
}

function fmtDia(dataStr: string): string {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  if (dataStr === hoje) return 'Hoje'
  const d = new Date(`${dataStr}T12:00:00Z`)
  return d.toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC',
  })
}

export default async function RelatorioDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ unit_id?: string }>
}) {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role === 'cozinheiro') redirect('/')

  const supabase = createServiceClient()

  let ownUnitId: string | null = null
  if (session.role !== 'admin') {
    const { data: emp } = await supabase
      .from('employees')
      .select('unit_id')
      .eq('id', session.employeeId)
      .single()
    ownUnitId = emp?.unit_id ?? null
  }

  const { unit_id } = await searchParams

  const ORDEM_UNIDADES: string[] = []

  const { data: unitsRaw } = await supabase
    .from('units')
    .select('id, name')
    .eq('active', true)

  const units = (unitsRaw ?? []).sort((a, b) => {
    const ia = ORDEM_UNIDADES.indexOf(a.name)
    const ib = ORDEM_UNIDADES.indexOf(b.name)
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const activeUnitId = session.role === 'admin'
    ? (unit_id ?? units?.[0]?.id ?? '')
    : (ownUnitId ?? '')

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data: relatorios } = activeUnitId
    ? await supabase
        .from('op_relatorio_diario')
        .select('id, data, status')
        .eq('unit_id', activeUnitId)
        .gte('data', sinceStr)
        .order('data', { ascending: false })
    : { data: [] }

  // Config de períodos da unidade (quais períodos existem)
  const { data: unitConfig } = activeUnitId
    ? await supabase.from('op_unit_config').select('periodos').eq('unit_id', activeUnitId).single()
    : { data: null }
  const periodosAtivos: string[] = (unitConfig?.periodos as string[] | null) ?? ['almoco', 'jantar']

  // Períodos de todos os relatórios listados, pra montar os chips por dia
  const relIds = (relatorios ?? []).map(r => r.id)
  const [{ data: periodosDb }, { data: horarioPadraoRaw }] = await Promise.all([
    relIds.length
      ? supabase.from('op_relatorio_periodo').select('relatorio_id, periodo, sequencia, status, enviado_em').in('relatorio_id', relIds)
      : Promise.resolve({ data: [] }),
    activeUnitId
      ? supabase.from('op_horario_padrao').select('dia_semana, periodo').eq('unit_id', activeUnitId)
      : Promise.resolve({ data: [] }),
  ])
  const horarioPadrao = horarioPadraoRaw ?? []
  const unitTemHorario = horarioPadrao.length > 0

  type ChipRow = { periodo: string; sequencia: number; status: string }
  const periodosPorRel = new Map<string, ChipRow[]>()
  for (const p of periodosDb ?? []) {
    const arr = periodosPorRel.get(p.relatorio_id) ?? []
    arr.push({
      periodo: p.periodo,
      sequencia: Number(p.sequencia ?? 1),
      status: p.enviado_em ? 'enviado' : (p.status ?? 'rascunho'),
    })
    periodosPorRel.set(p.relatorio_id, arr)
  }

  const unitName = units?.find(u => u.id === activeUnitId)?.name ?? ''
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const temHoje = relatorios?.some(r => r.data === hoje)

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Resumo Operacional</h1>
          <p className="text-sm text-ink-muted">{unitName} · últimos 30 dias</p>
        </div>
        <div className="flex gap-2">
          {session.role === 'admin' && (
            <Link
              href="/relatorio-diario/painel-geral"
              className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink transition-colors"
            >
              Painel Geral
            </Link>
          )}
          <Link
            href={`/relatorio-diario/${hoje}?unit_id=${activeUnitId}`}
            className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            {temHoje ? 'Continuar hoje' : 'Preencher hoje'}
          </Link>
        </div>
      </div>

      {session.role === 'admin' && (units?.length ?? 0) > 1 && (
        <div className="flex gap-2 flex-wrap">
          {units?.map(u => (
            <Link
              key={u.id}
              href={`?unit_id=${u.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                u.id === activeUnitId
                  ? 'border-ember bg-ember/10 text-ember'
                  : 'border-edge text-ink-muted hover:text-ink'
              }`}
            >
              {u.name}
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-edge bg-surface divide-y divide-edge">
        {(relatorios?.length ?? 0) === 0 && (
          <p className="px-5 py-8 text-center text-sm text-ink-subtle">
            Nenhum relatório nos últimos 30 dias.
          </p>
        )}
        {relatorios?.map(r => {
          const { cor, label } = getStatusDot(r.status, r.data)
          const rowsPorDia = periodosPorRel.get(r.id) ?? []

          // Espinha dorsal por dia da semana (baseada em op_horario_padrao)
          const diaSemanaRel = new Date(`${r.data}T12:00:00Z`).getUTCDay()
          const doDia = horarioPadrao.filter(h => h.dia_semana === diaSemanaRel).map(h => h.periodo)
          let periodosFixosDoDia: string[]
          if (unitTemHorario) {
            const set = new Set(doDia)
            periodosFixosDoDia = set.has('unico') ? ['almoco', 'jantar'] : doDia.filter(p => p !== 'unico')
          } else {
            periodosFixosDoDia = periodosAtivos.filter(p => p !== 'eventos' && p !== 'manha')
          }

          const CHIP_ORDER = ['manha', 'almoco', 'jantar']
          const baseChips = periodosFixosDoDia
            .map(p => ({
              periodo: p,
              sequencia: 1,
              status: rowsPorDia.find(r => r.periodo === p && r.sequencia === 1)?.status ?? 'pendente',
            }))
          // Chips extras: manha opt-in + todos os eventos
          const extraChips = rowsPorDia.filter(r =>
            r.periodo === 'manha' || r.periodo === 'eventos'
          )
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
              key={r.id}
              href={`/relatorio-diario/${r.data}?unit_id=${activeUnitId}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-surface-raised/50 transition-colors"
            >
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cor}`} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-ink">{fmtDia(r.data)}</span>
                <div className="mt-1 flex flex-wrap gap-1">
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
                          enviado
                            ? 'bg-fresh/15 text-fresh-bright'
                            : na
                            ? 'bg-edge/20 text-ink-faint/60'
                            : 'bg-edge/40 text-ink-muted'
                        }`}
                      >
                        {chipLabel}
                      </span>
                    )
                  })}
                </div>
              </div>
              <span className="text-xs text-ink-muted shrink-0">{label}</span>
              <ChevronRight className="h-4 w-4 text-ink-faint shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
