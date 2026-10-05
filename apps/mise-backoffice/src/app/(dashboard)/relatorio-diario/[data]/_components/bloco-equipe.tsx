'use client'
import { Plus, X } from 'lucide-react'
import { SETORES_EQUIPE, type SetorEquipe } from '@/app/api/relatorio-diario/_schema'
import { SeletorColaborador, type Colaborador } from './seletor-colaborador'

export type EquipeSetorState = { lider: string; houveFalta: boolean; ausentes: string[] }
export type EquipeState = Record<SetorEquipe, EquipeSetorState>

export function BlocoEquipe({
  value,
  onChange,
  disabled,
  colaboradores,
  erros,
}: {
  value: EquipeState
  onChange: (v: EquipeState) => void
  disabled?: boolean
  colaboradores: Colaborador[]
  erros?: Partial<Record<SetorEquipe, boolean>>
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-5 space-y-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Equipe</p>
      {SETORES_EQUIPE.map(setor => {
        const estado = value[setor]
        const erroLider = erros?.[setor]
        return (
          <div key={setor} className="space-y-2.5">
            <span className="text-sm font-medium text-ink">{setor}</span>

            {/* Líder — sempre visível, obrigatório */}
            <SeletorColaborador
              id={`equipe-lider-${setor}`}
              colaboradores={colaboradores}
              value={estado.lider}
              onChange={v => onChange({ ...value, [setor]: { ...estado, lider: v } })}
              disabled={disabled}
              placeholder={`Líder de ${setor}`}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50 bg-base ${
                erroLider
                  ? 'border-alert focus:border-alert'
                  : 'border-edge focus:border-ember'
              }`}
            />
            {erroLider && (
              <p className="text-xs text-alert-bright">Informe o líder de {setor}</p>
            )}

            {/* Toggle Houve falta? */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-muted">Houve falta?</span>
              <div className="flex gap-2">
                {(['Não', 'Sim'] as const).map(label => {
                  const houve = label === 'Sim'
                  const ativo = estado.houveFalta === houve
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => onChange({
                        ...value,
                        [setor]: { ...estado, houveFalta: houve, ausentes: houve ? [''] : [] },
                      })}
                      disabled={disabled}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                        ativo && !houve
                          ? 'bg-fresh/20 text-fresh-bright border border-fresh/40'
                          : ativo && houve
                          ? 'bg-alert/10 text-alert-bright border border-alert/40'
                          : 'border border-edge text-ink-muted hover:text-ink'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Ausentes — só quando houve falta */}
            {estado.houveFalta && (
              <div className="space-y-2 pl-1">
                {estado.ausentes.map((nome, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex-1">
                      <SeletorColaborador
                        colaboradores={colaboradores}
                        value={nome}
                        onChange={v => {
                          const ausentes = [...estado.ausentes]
                          ausentes[i] = v
                          onChange({ ...value, [setor]: { ...estado, ausentes } })
                        }}
                        disabled={disabled}
                        placeholder={`Ausente ${i + 1}`}
                        className="w-full rounded-lg border border-alert/30 bg-base px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-alert focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    {estado.ausentes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onChange({
                          ...value,
                          [setor]: { ...estado, ausentes: estado.ausentes.filter((_, j) => j !== i) },
                        })}
                        disabled={disabled}
                        className="rounded-lg p-1.5 text-ink-muted hover:text-alert transition-colors disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onChange({
                    ...value,
                    [setor]: { ...estado, ausentes: [...estado.ausentes, ''] },
                  })}
                  disabled={disabled}
                  className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar ausente
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
