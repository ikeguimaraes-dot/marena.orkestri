'use client'
import { Clock } from 'lucide-react'

export type HorariosState = {
  abertura: string
  ultimo_cliente: string
  fechamento: string
}

export function BlocoHorarios({
  value,
  onChange,
  disabled,
  erros,
}: {
  value: HorariosState
  onChange: (v: HorariosState) => void
  disabled?: boolean
  erros?: Partial<Record<keyof HorariosState, boolean>>
}) {
  const campos: { key: keyof HorariosState; label: string }[] = [
    { key: 'abertura', label: 'Abertura' },
    { key: 'ultimo_cliente', label: 'Último cliente' },
    { key: 'fechamento', label: 'Fechamento' },
  ]

  return (
    <div className="rounded-xl border border-edge bg-surface p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-ink-faint" />
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Horários</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {campos.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <label className="text-xs font-medium text-ink-muted">{label}</label>
            <input
              id={`horario-${key}`}
              type="time"
              value={value[key]}
              onChange={e => onChange({ ...value, [key]: e.target.value })}
              disabled={disabled}
              className={`w-full rounded-lg border bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50 ${
                erros?.[key] ? 'border-alert focus:border-alert' : 'border-edge focus:border-ember'
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
