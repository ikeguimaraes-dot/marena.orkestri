'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'

type LabelItem = {
  id: string
  unit_id: string
  employee_id: string | null
  data_manipulacao: string
  validade: string
  status: string
  metodo_conservacao: string | null
  setor: string | null
  peso_kg: number | null
  employee_name?: string | null
}

type Group = {
  nome: string
  total_count: number
  total_peso_kg: number
  labels: LabelItem[]
}

type Unit = { id: string; name: string }

const STATUS_BADGE: Record<string, string> = {
  ativa: 'text-fresh-bright bg-fresh/10',
  consumida: 'text-info bg-info/10',
  descartada: 'text-alert-bright bg-alert/10',
  vencida: 'text-warn-bright bg-warn/10',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function RelatorioClient({
  initialGroups,
  initialTotalLabels,
  initialTotalPeso,
  initialDataInicio,
  initialDataFim,
  initialUnitName,
  units,
}: {
  initialGroups: Group[]
  initialTotalLabels: number
  initialTotalPeso: number
  initialDataInicio: string
  initialDataFim: string
  initialUnitName: string
  units: Unit[]
}) {
  const [groups, setGroups] = useState(initialGroups)
  const [totalLabels, setTotalLabels] = useState(initialTotalLabels)
  const [totalPeso, setTotalPeso] = useState(initialTotalPeso)
  const [dataInicio, setDataInicio] = useState(initialDataInicio)
  const [dataFim, setDataFim] = useState(initialDataFim)
  const [unitId, setUnitId] = useState('')
  const [unitName, setUnitName] = useState(initialUnitName)
  const [periodo, setPeriodo] = useState('hoje')
  const [loading, setLoading] = useState(false)

  function getDateRange(p: string): { inicio: string; fim: string } {
    const spDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const today = spDate
    const sp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))

    if (p === 'hoje') return { inicio: today, fim: today }
    if (p === 'ontem') {
      const d = new Date(sp); d.setDate(d.getDate() - 1)
      const s = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
      return { inicio: s, fim: s }
    }
    if (p === '7dias') {
      const d = new Date(sp); d.setDate(d.getDate() - 6)
      return { inicio: d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), fim: today }
    }
    if (p === '30dias') {
      const d = new Date(sp); d.setDate(d.getDate() - 29)
      return { inicio: d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), fim: today }
    }
    return { inicio: dataInicio, fim: dataFim }
  }

  async function handleFetch() {
    setLoading(true)
    const { inicio, fim } = periodo === 'custom' ? { inicio: dataInicio, fim: dataFim } : getDateRange(periodo)
    const params = new URLSearchParams({ data_inicio: inicio, data_fim: fim })
    if (unitId) params.set('unit_id', unitId)

    const res = await fetch(`/api/relatorios/producao?${params}`)
    const data = await res.json()
    setGroups(data.groups ?? [])
    setTotalLabels(data.total_labels ?? 0)
    setTotalPeso(data.total_peso_kg ?? 0)
    setUnitName(data.unit_name ?? 'Todas as unidades')
    if (periodo !== 'custom') {
      const { inicio: i, fim: f } = getDateRange(periodo)
      setDataInicio(i)
      setDataFim(f)
    }
    setLoading(false)
  }

  function handlePrint() {
    const rows = groups.flatMap(g =>
      g.labels.map(l => `
        <tr style="background:#1f2937;color:#fff" class="group-header">
          <td colspan="8" style="padding:6px 10px;font-weight:bold">${g.nome} — ${g.total_count} etiqueta${g.total_count !== 1 ? 's' : ''} · ${g.total_peso_kg.toFixed(3)} kg</td>
        </tr>
        <tr>
          <td>${fmt(l.data_manipulacao)}</td>
          <td>${fmt(l.validade)}</td>
          <td>${l.metodo_conservacao ?? '—'}</td>
          <td>${l.setor ?? '—'}</td>
          <td>${l.peso_kg != null ? `${(l.peso_kg * 1000).toLocaleString('pt-BR')} g` : '—'}</td>
          <td>${l.employee_name ?? '—'}</td>
          <td>${l.status}</td>
        </tr>
      `).join('')
    )

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>@page{size:A4 portrait;margin:12mm 10mm}body{font-family:Arial,sans-serif;font-size:9pt;color:#000}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:4px 6px;text-align:left;font-size:8pt}
th{background:#f3f4f6;font-weight:bold}.page-break{page-break-inside:avoid}h2{font-size:12pt;margin:0 0 4px}
.sub{font-size:9pt;color:#555;margin:0 0 12px}</style></head><body>
<h2>Relatório de Produção — ${unitName}</h2>
<p class="sub">Período: ${dataInicio} a ${dataFim} · Emitido: ${new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
<table><thead><tr>
<th>Manipulação</th><th>Validade</th><th>Método</th><th>Setor</th><th>Peso</th><th>Responsável</th><th>Status</th>
</tr></thead><tbody>${rows}</tbody></table>
<p style="margin-top:8px;font-size:8pt;color:#555">Total: ${totalLabels} etiquetas · ${totalPeso.toFixed(3)} kg</p>
<p style="font-size:7pt;color:#999">Manipulação = data de geração da etiqueta</p>
</body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 300)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Relatório de Produção</h1>
        <p className="text-sm text-ink-muted">Etiquetas geradas por período</p>
      </div>

      <div className="rounded-xl border border-edge bg-surface p-5">
        <div className="flex flex-wrap gap-3">
          <select value={periodo} onChange={e => setPeriodo(e.target.value)}
            className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-1.5 text-sm text-ink focus:outline-none">
            <option value="hoje">Hoje</option>
            <option value="ontem">Ontem</option>
            <option value="7dias">Últimos 7 dias</option>
            <option value="30dias">Últimos 30 dias</option>
            <option value="custom">Personalizado</option>
          </select>

          {periodo === 'custom' && (
            <>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-1.5 text-sm text-ink focus:outline-none" />
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-1.5 text-sm text-ink focus:outline-none" />
            </>
          )}

          <select value={unitId} onChange={e => setUnitId(e.target.value)}
            className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-1.5 text-sm text-ink focus:outline-none">
            <option value="">Todas as unidades</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          <button onClick={handleFetch} disabled={loading}
            className="rounded-lg bg-ember px-4 py-1.5 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-50 transition-colors">
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {totalLabels > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Etiquetas no período', value: totalLabels, color: 'text-fresh' },
            { label: 'Produtos diferentes', value: groups.length, color: 'text-info' },
            { label: 'Peso total', value: `${totalPeso.toFixed(2)} kg`, color: 'text-ink' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-edge bg-surface p-4">
              <p className="text-xs font-medium text-ink-muted">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-edge bg-surface">
        <div className="flex items-center justify-between border-b border-edge px-5 py-4">
          <p className="text-sm font-semibold text-ink">
            {unitName} · {dataInicio} a {dataFim}
          </p>
          {totalLabels > 0 && (
            <button onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg border border-edge-strong px-3 py-1.5 text-sm text-ink-muted hover:text-ink transition-colors">
              <FileText className="h-4 w-4" />
              Exportar PDF
            </button>
          )}
        </div>

        {groups.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-subtle">Nenhuma etiqueta no período.</p>
        ) : (
          <div>
            {groups.map(g => (
              <div key={g.nome} className="border-b border-edge last:border-0">
                <div className="flex items-center justify-between bg-surface-raised px-5 py-3">
                  <p className="text-sm font-semibold text-ink">{g.nome}</p>
                  <p className="text-xs text-ink-muted">
                    {g.total_count} etiqueta{g.total_count !== 1 ? 's' : ''} · {g.total_peso_kg.toFixed(3)} kg
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-edge">
                        {['Manipulação', 'Validade', 'Método', 'Setor', 'Peso', 'Responsável', 'Status'].map(h => (
                          <th key={h} className="px-5 py-2 text-left text-xs font-medium text-ink-muted">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-edge">
                      {g.labels.map((l, i) => (
                        <tr key={l.id} className={i % 2 === 1 ? 'bg-surface-raised/30' : ''}>
                          <td className="px-5 py-2 text-ink-muted">{fmt(l.data_manipulacao)}</td>
                          <td className="px-5 py-2 text-ink-muted">{fmt(l.validade)}</td>
                          <td className="px-5 py-2 text-ink-muted">{l.metodo_conservacao ?? '—'}</td>
                          <td className="px-5 py-2 text-ink-muted">{l.setor ?? '—'}</td>
                          <td className="px-5 py-2 text-ink-muted">
                            {l.peso_kg != null ? `${(l.peso_kg * 1000).toLocaleString('pt-BR')} g` : '—'}
                          </td>
                          <td className="px-5 py-2 text-ink-muted">{l.employee_name ?? '—'}</td>
                          <td className="px-5 py-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[l.status] ?? ''}`}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-edge px-5 py-3">
              <p className="text-xs text-ink-subtle">Total: {totalLabels} etiquetas</p>
              <p className="text-xs text-ink-subtle">Peso total: {totalPeso.toFixed(3)} kg</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
