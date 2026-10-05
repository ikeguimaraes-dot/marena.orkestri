'use client'
import { TextareaAuto } from './textarea-auto'

export type OcorrenciaState = { houve: boolean; descricao: string }

export function BlocoOcorrencia({
  value,
  onChange,
  disabled,
}: {
  value: OcorrenciaState
  onChange: (v: OcorrenciaState) => void
  disabled?: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 space-y-3 ${
      value.houve ? 'border-alert bg-alert/5' : 'border-edge bg-surface'
    }`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Ocorrência</p>
        <div className="flex gap-2">
          {(['Não', 'Sim'] as const).map(label => {
            const houve = label === 'Sim'
            const ativo = value.houve === houve
            return (
              <button
                key={label}
                type="button"
                onClick={() => onChange({ ...value, houve })}
                disabled={disabled}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  ativo && !houve
                    ? 'bg-fresh/20 text-fresh-bright border border-fresh/40'
                    : ativo && houve
                    ? 'bg-alert/10 text-alert-bright border border-alert/40'
                    : 'text-ink-muted hover:text-ink border border-edge'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      {value.houve && (
        <TextareaAuto
          value={value.descricao}
          onChange={descricao => onChange({ ...value, descricao })}
          disabled={disabled}
          placeholder="Descreva a ocorrência…"
          className="w-full rounded-lg border border-alert/40 bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-alert focus:outline-none disabled:opacity-50"
        />
      )}
    </div>
  )
}
