export type EventoInfoState = { nome: string; contato: string }

export function BlocoEventoInfo({
  value, onChange, disabled, erro,
}: {
  value: EventoInfoState
  onChange: (v: EventoInfoState) => void
  disabled?: boolean
  erro?: boolean
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Evento</p>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">Nome do evento *</label>
          <input
            id="evento_nome"
            type="text"
            value={value.nome}
            onChange={e => onChange({ ...value, nome: e.target.value })}
            disabled={disabled}
            placeholder="ex: Aniversário de 30 anos"
            className={`w-full rounded-lg border bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50 ${
              erro ? 'border-alert focus:border-alert' : 'border-edge focus:border-ember'
            }`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted">Contato principal</label>
          <input
            type="text"
            value={value.contato}
            onChange={e => onChange({ ...value, contato: e.target.value })}
            disabled={disabled}
            placeholder="Nome de quem organizou / contratou"
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-ember disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  )
}
