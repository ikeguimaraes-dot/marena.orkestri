'use client'
import { useState } from 'react'

export function RegistroColapsavel({
  titulo, count, onNao, children,
}: {
  titulo: string
  count: number
  onNao?: () => void | Promise<void>
  children: React.ReactNode
}) {
  const [aberto, setAberto] = useState(count > 0)

  async function handleClick(valor: boolean) {
    if (!valor && count > 0) {
      if (!confirm(`Marcar "Não" vai apagar os ${count} registro(s) já adicionados aqui. Confirma?`)) return
      await onNao?.()
    }
    setAberto(valor)
  }

  return (
    <div className="rounded-xl border border-edge bg-surface overflow-hidden">
      <div className="flex w-full items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-ink">{titulo}</span>
          {count > 0 && (
            <span className="rounded-full bg-ember/10 px-2 py-0.5 text-xs font-semibold text-ember">
              {count}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {(['Não', 'Sim'] as const).map(label => {
            const isAberto = label === 'Sim'
            const ativo = aberto === isAberto
            return (
              <button
                key={label}
                type="button"
                onClick={() => handleClick(isAberto)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  ativo && !isAberto
                    ? 'bg-fresh/20 text-fresh-bright border border-fresh/40'
                    : ativo && isAberto
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
      <div
        data-colapsavel-content=""
        className={`border-t border-edge px-5 py-4 space-y-4 ${aberto ? '' : 'hidden print:!block'}`}
      >
        {children}
      </div>
    </div>
  )
}
