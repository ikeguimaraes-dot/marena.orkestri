'use client'

import { useState, useEffect } from 'react'
import type { LabelRow, UnitOption } from '../page'

function startOfDaySP(offsetDays = 0): Date {
  const spStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const [y, m, d] = spStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + offsetDays, 3, 0, 0, 0))
}

function getBucket(validade: string, now: Date) {
  const v = new Date(validade)
  if (v < now) return 'vencidos'
  if (v < startOfDaySP(1)) return 'hoje'
  if (v < startOfDaySP(2)) return 'amanha'
  if (v < startOfDaySP(3)) return 'tres_dias'
  return 'ok'
}

function getUrgencyClass(validade: string, now: Date) {
  const diff = new Date(validade).getTime() - now.getTime()
  if (diff < 0) return 'text-alert-bright bg-alert/10'
  if (diff < 6 * 3600000) return 'text-warn-bright bg-warn/10'
  if (diff < 24 * 3600000) return 'text-warn bg-warn/10'
  if (diff < 72 * 3600000) return 'text-info bg-info/10'
  return 'text-fresh-bright bg-fresh/10'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function TimeRemaining({ validade, now }: { validade: string; now: Date }) {
  const diff = new Date(validade).getTime() - now.getTime()
  if (diff < 0) return <span className="text-xs font-medium text-alert-bright">VENCIDA</span>
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return <span className="text-xs font-medium text-ink-muted">{h}h {m}m</span>
}

export function ValidadesClient({ initialLabels, units }: { initialLabels: LabelRow[]; units: UnitOption[] }) {
  const [labels, setLabels] = useState(initialLabels)
  const [now, setNow] = useState(new Date())
  const [unitFilter, setUnitFilter] = useState('')
  const [bucketFilter, setBucketFilter] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const filtered = labels.filter(l => !unitFilter || l.unit_id === unitFilter)

  const counts = {
    vencidos: filtered.filter(l => getBucket(l.validade, now) === 'vencidos').length,
    hoje: filtered.filter(l => getBucket(l.validade, now) === 'hoje').length,
    amanha: filtered.filter(l => getBucket(l.validade, now) === 'amanha').length,
    tres_dias: filtered.filter(l => getBucket(l.validade, now) === 'tres_dias').length,
  }

  const displayed = bucketFilter
    ? filtered.filter(l => getBucket(l.validade, now) === bucketFilter)
    : filtered

  async function handleAction(id: string, status: 'consumida' | 'descartada') {
    setLabels(prev => prev.filter(l => l.id !== id))
    const res = await fetch(`/api/labels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) setLabels(initialLabels)
  }

  const CARDS = [
    { key: 'vencidos', label: 'Vencidos', count: counts.vencidos, color: 'text-alert', border: 'border-alert' },
    { key: 'hoje', label: 'Vencem Hoje', count: counts.hoje, color: 'text-warn-bright', border: 'border-warn' },
    { key: 'amanha', label: 'Amanhã', count: counts.amanha, color: 'text-warn', border: 'border-warn' },
    { key: 'tres_dias', label: 'Próximos 3 dias', count: counts.tres_dias, color: 'text-info', border: 'border-info' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Validades</h1>
          <p className="text-sm text-ink-muted">Monitoramento em tempo real</p>
        </div>
        <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}
          className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-1.5 text-sm text-ink focus:outline-none">
          <option value="">Todas as unidades</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {CARDS.map(({ key, label, count, color, border }) => (
          <button key={key} onClick={() => setBucketFilter(bucketFilter === key ? null : key)}
            className={`rounded-xl border bg-surface p-4 text-left transition-all ${
              bucketFilter === key ? border : 'border-edge hover:border-edge-strong'
            }`}>
            <p className="text-xs font-medium text-ink-muted">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${color}`}>{count}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-edge bg-surface">
        <div className="border-b border-edge px-5 py-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">
            Etiquetas ativas{bucketFilter ? ` — ${CARDS.find(c => c.key === bucketFilter)?.label}` : ''}
          </p>
          <p className="text-xs text-ink-subtle">{displayed.length} etiqueta{displayed.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="divide-y divide-edge">
          {displayed.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-subtle">Nenhuma etiqueta neste filtro.</p>
          )}
          {displayed.map(l => (
            <div key={l.id} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-raised/50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{l.nome}</p>
                <p className="text-xs text-ink-subtle">{l.unit_name} · {l.employee_name ?? '—'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-ink-muted">{formatDate(l.validade)}</p>
                <TimeRemaining validade={l.validade} now={now} />
              </div>
              <span className={`hidden sm:inline-block rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${getUrgencyClass(l.validade, now)}`}>
                {getBucket(l.validade, now) === 'vencidos' ? 'Vencida' : 'Ativa'}
              </span>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => handleAction(l.id, 'consumida')}
                  title="Este item foi utilizado na produção — não conta como desperdício"
                  className="rounded border border-info px-2 py-1 text-xs text-info hover:bg-info-soft transition-colors">
                  Usado no preparo
                </button>
                <button onClick={() => handleAction(l.id, 'descartada')}
                  title="Este item foi jogado fora sem uso — conta como perda no relatório de desperdício"
                  className="rounded border border-alert px-2 py-1 text-xs text-alert hover:bg-alert-soft transition-colors">
                  Descartar (perda)
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
