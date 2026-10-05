'use client'
import { SETORES_AVALIACAO, type SetorAvaliacao } from '@/app/api/relatorio-diario/_schema'
import { TextareaAuto } from './textarea-auto'

export type AvaliacaoItem = { nota: number | null; obs: string }
export type AvaliacaoSetoresState = Record<SetorAvaliacao, AvaliacaoItem>

// Gradiente contínuo 0 (vermelho intenso) → 5 (verde intenso).
// Cores derivadas do design system (alert / warn / fresh) interpoladas.
const NOTA_COR: Record<number, { bg: string; fg: string; border: string }> = {
  0: { bg: '#C75D4A', fg: '#FFFFFF', border: '#C75D4A' }, // vermelho intenso
  1: { bg: '#D97B4A', fg: '#FFFFFF', border: '#D97B4A' }, // laranja-avermelhado
  2: { bg: '#E0B252', fg: '#412402', border: '#E0B252' }, // âmbar
  3: { bg: '#C9C05A', fg: '#2A2A0A', border: '#C9C05A' }, // amarelo-esverdeado
  4: { bg: '#7FB87A', fg: '#04342C', border: '#7FB87A' }, // verde médio
  5: { bg: '#4A9D7F', fg: '#FFFFFF', border: '#4A9D7F' }, // verde intenso
}

// Significado de cada nota (legenda)
const NOTA_LEGENDA: Record<number, string> = {
  0: 'Crítico',
  1: 'Ruim',
  2: 'Abaixo',
  3: 'Regular',
  4: 'Bom',
  5: 'Excelente',
}

export function BlocoSetores({
  value,
  onChange,
  disabled,
  erros,
}: {
  value: AvaliacaoSetoresState
  onChange: (v: AvaliacaoSetoresState) => void
  disabled?: boolean
  erros?: Partial<Record<SetorAvaliacao, boolean>>
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-5 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Avaliação dos Setores</p>

      {/* Legenda das notas */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
        {[0, 1, 2, 3, 4, 5].map(n => (
          <span key={n} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: NOTA_COR[n].bg }} />
            {n} · {NOTA_LEGENDA[n]}
          </span>
        ))}
      </div>

      {/* Nota Geral calculada */}
      {(() => {
        const notas = (Object.values(value) as AvaliacaoItem[])
          .map(av => av.nota)
          .filter((n): n is number => n !== null)
        if (notas.length === 0) return null
        const media = notas.reduce((a, b) => a + b, 0) / notas.length
        const idx = Math.round(media) as keyof typeof NOTA_COR
        const cor = NOTA_COR[idx]
        return (
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ backgroundColor: cor.bg, color: cor.fg }}
          >
            <span className="text-sm font-semibold">Nota Geral</span>
            <span className="text-sm font-bold">{media.toFixed(1)}</span>
          </div>
        )
      })()}

      {SETORES_AVALIACAO.map(setor => {
        const av = value[setor]
        const obsObrigatoria = av.nota !== null && av.nota <= 2
        const erroObs = erros?.[setor] && obsObrigatoria && !av.obs.trim()
        return (
          <div key={setor} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">{setor}</span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5].map(n => {
                  const ativo = av.nota === n
                  const cor = NOTA_COR[n]
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onChange({
                        ...value,
                        [setor]: { ...av, nota: av.nota === n ? null : n },
                      })}
                      disabled={disabled}
                      style={ativo ? { backgroundColor: cor.bg, color: cor.fg, borderColor: cor.border } : undefined}
                      className={`h-8 w-8 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-50 ${
                        ativo ? '' : 'border-edge text-ink-muted hover:border-ink'
                      }`}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>
            {obsObrigatoria && (
              <TextareaAuto
                id={`setor-obs-${setor}`}
                value={av.obs}
                onChange={obs => onChange({ ...value, [setor]: { ...av, obs } })}
                disabled={disabled}
                placeholder={`Observação obrigatória para nota ${av.nota}…`}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50 bg-base ${
                  erroObs ? 'border-alert focus:border-alert' : 'border-edge focus:border-ember'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
