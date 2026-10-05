'use client'

export function CampoResponsavel({
  value,
  onChange,
  disabled,
  erro,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  erro?: boolean
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
        Responsável pelo Preenchimento <span className="text-ember ml-0.5">*</span>
      </p>
      <input
        id="responsavel_preenchimento"
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Nome de quem está preenchendo"
        className={`w-full rounded-lg border px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50 bg-base ${
          erro ? 'border-alert focus:border-alert' : 'border-edge focus:border-ember'
        }`}
      />
    </div>
  )
}
