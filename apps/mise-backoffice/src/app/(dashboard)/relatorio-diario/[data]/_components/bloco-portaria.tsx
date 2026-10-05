'use client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { RegistroColapsavel } from './registro-colapsavel'

export type PortariaState = { reservas: string; no_show: string; passantes: string }
type Desistencia = { id: string; motivo: string | null; pax_perdido: number | null }

function num(v: string) { return parseInt(v) || 0 }

export function BlocoPortaria({
  value,
  onChange,
  relatorioData,
  unitId,
  periodo,
  disabled,
  desistenciasIniciais,
}: {
  value: PortariaState
  onChange: (v: PortariaState) => void
  relatorioData: string
  unitId: string
  periodo: string
  disabled?: boolean
  desistenciasIniciais?: Desistencia[]
}) {
  const [desistencias, setDesistencias] = useState<Desistencia[]>(desistenciasIniciais ?? [])
  const [novoMotivo, setNovoMotivo] = useState('')
  const [novoPax, setNovoPax] = useState('')
  const [salvandoDesist, setSalvandoDesist] = useState(false)
  const [erro, setErro] = useState('')

  const reservas = num(value.reservas)
  const no_show = num(value.no_show)
  const passantes = num(value.passantes)
  const resultado = reservas - no_show + passantes
  // Taxa de No-Show = no_show / total de reservas
  const taxaNoShow = reservas > 0 ? (no_show / reservas) * 100 : NaN
  const taxaPassante = resultado > 0 ? (passantes / resultado) * 100 : NaN

  async function adicionarDesistencia() {
    setSalvandoDesist(true); setErro('')
    const res = await fetch(`/api/relatorio-diario/${relatorioData}/registros/portaria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unit_id: unitId,
        periodo,
        motivo: novoMotivo || null,
        pax_perdido: novoPax || null,
      }),
    })
    if (res.ok) {
      const item = await res.json()
      setDesistencias(prev => [...prev, item])
      setNovoMotivo(''); setNovoPax('')
    } else {
      const { error } = await res.json()
      setErro(error ?? 'Erro ao adicionar desistência.')
    }
    setSalvandoDesist(false)
  }

  async function removerDesistencia(id: string) {
    const res = await fetch(`/api/relatorio-diario/${relatorioData}/registros/portaria?unit_id=${unitId}&id=${id}&tipo=desistencia`, { method: 'DELETE' })
    if (res.ok) setDesistencias(prev => prev.filter(d => d.id !== id))
  }

  const campos: [keyof PortariaState, string][] = [
    ['reservas', 'Reservas'],
    ['no_show', 'No-Show'],
    ['passantes', 'Passantes'],
  ]

  async function apagarTudo() {
    await Promise.all(desistencias.map(d => removerDesistencia(d.id)))
  }

  return (
    <RegistroColapsavel titulo="Portaria" count={desistencias.length} onNao={apagarTudo}>
      {/* Entradas — salvam via autosave do período (sem botão dedicado) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {campos.map(([key, label]) => (
          <div key={key} className="space-y-1">
            <label className="text-xs font-medium text-ink-muted">{label}</label>
            <input type="number" inputMode="numeric" min="0" value={value[key]}
              onChange={e => onChange({ ...value, [key]: e.target.value })}
              disabled={disabled}
              className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none disabled:opacity-50" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-edge/50 bg-base p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-ink-muted">Resultado</span>
        <span className="text-ink font-medium text-right">{resultado} pax</span>
        <span className="text-ink-muted">Taxa de No-Show</span>
        <span className="text-ink font-medium text-right">{isNaN(taxaNoShow) ? '—' : `${taxaNoShow.toFixed(1)}%`}</span>
        <span className="text-ink-muted">Taxa de Passante</span>
        <span className="text-ink font-medium text-right">{isNaN(taxaPassante) ? '—' : `${taxaPassante.toFixed(1)}%`}</span>
      </div>

      {/* Desistências */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Desistências ({desistencias.length})</p>
        {desistencias.map(d => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-edge bg-base px-3 py-2">
            <span className="text-sm text-ink">
              {d.motivo ?? '(sem motivo)'}
              {d.pax_perdido != null && <span className="text-ink-muted"> · {d.pax_perdido} pax</span>}
            </span>
            {!disabled && (
              <button onClick={() => removerDesistencia(d.id)} className="text-ink-faint hover:text-alert transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {erro && <p className="text-xs text-alert-bright">{erro}</p>}
        {!disabled && (
          <div className="flex gap-2">
            <input type="text" value={novoMotivo} onChange={e => setNovoMotivo(e.target.value)}
              placeholder="Motivo da desistência"
              className="flex-1 rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none" />
            <input type="number" inputMode="numeric" min="0" value={novoPax} onChange={e => setNovoPax(e.target.value)}
              placeholder="Pax"
              className="w-20 rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none" />
            <button onClick={adicionarDesistencia} disabled={salvandoDesist}
              className="rounded-lg border border-edge bg-surface-raised px-3 py-2 text-sm font-medium text-ink hover:bg-surface transition-colors disabled:opacity-50">
              {salvandoDesist ? '…' : '+'}
            </button>
          </div>
        )}
      </div>
    </RegistroColapsavel>
  )
}
