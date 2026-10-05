'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreVertical, Pencil, Copy, Trash2 } from 'lucide-react'

const TIPO_COLORS: Record<string, string> = {
  abertura: 'border-l-fresh bg-fresh/5',
  fechamento: 'border-l-alert bg-alert/5',
  rotina: 'border-l-info bg-info/5',
  relatorio: 'border-l-purple-500 bg-purple-500/5',
  treinamento: 'border-l-warn bg-warn/5',
}

const TIPO_LABEL: Record<string, string> = {
  abertura: 'Abertura', fechamento: 'Fechamento', rotina: 'Rotina',
  relatorio: 'Relatório', treinamento: 'Treinamento',
}

function scoreColor(pct: number | null) {
  if (pct === null) return 'text-ink-subtle'
  if (pct >= 80) return 'text-fresh-bright'
  if (pct >= 60) return 'text-warn-bright'
  return 'text-alert-bright'
}

type Props = {
  template: {
    id: string
    nome: string
    tipo: string | null
    departamento: string | null
    unit_id: string | null
  }
  score: number | null
  count: number
  unitName: string | null
}

export function TemplateCard({ template, score, count, unitName }: Props) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const colorClass = TIPO_COLORS[template.tipo ?? ''] ?? 'border-l-ink-faint bg-surface-raised/30'

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  async function handleExcluir() {
    setMenuOpen(false)
    if (!confirm(`Excluir "${template.nome}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/checklists/${template.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(`Erro ao excluir: ${data.error}`)
        return
      }
      router.refresh()
    } catch {
      alert('Erro ao excluir checklist.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleDuplicar() {
    setMenuOpen(false)
    setDuplicating(true)
    try {
      const res = await fetch(`/api/checklists/${template.id}/duplicar`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        alert(`Erro ao duplicar: ${data.error}`)
        return
      }
      router.refresh()
    } catch {
      alert('Erro ao duplicar checklist.')
    } finally {
      setDuplicating(false)
    }
  }

  return (
    <div className={`rounded-lg border border-edge border-l-4 ${colorClass} bg-surface p-5 flex flex-col gap-3 ${duplicating || deleting ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-ink leading-tight">{template.nome}</h3>
        <div className="flex items-center gap-1 shrink-0">
          {template.tipo && (
            <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-surface-raised text-ink-muted">
              {TIPO_LABEL[template.tipo] ?? template.tipo}
            </span>
          )}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-surface-raised hover:text-ink transition-colors"
              aria-label="Mais opções"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-20 w-36 rounded-lg border border-edge bg-base shadow-lg py-1">
                <Link
                  href={`/checklists/${template.id}/editar`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Link>
                <button
                  onClick={handleDuplicar}
                  disabled={duplicating}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink transition-colors disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicar
                </button>
                <div className="my-1 border-t border-edge" />
                <button
                  onClick={handleExcluir}
                  disabled={deleting}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-alert hover:bg-alert-soft hover:text-alert-bright transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {template.departamento && (
        <p className="text-xs text-ink-subtle">{template.departamento}</p>
      )}

      {template.unit_id && unitName && (
        <p className="text-xs text-ink-faint">{unitName}</p>
      )}

      <div className="flex items-center justify-between text-xs text-ink-subtle">
        <span>{count} {count === 1 ? 'item' : 'itens'}</span>
        <span>
          Última: <span className={`font-bold ${scoreColor(score)}`}>
            {score !== null ? `${score.toFixed(0)}%` : '—'}
          </span>
        </span>
      </div>

      <div className="flex gap-2 pt-1">
        <Link
          href={`/checklists/${template.id}`}
          className="flex-1 rounded border border-edge-strong px-3 py-1.5 text-center text-xs font-medium text-ink-muted hover:bg-surface-raised transition-colors"
        >
          Ver detalhes
        </Link>
        <Link
          href={`/checklists/${template.id}`}
          className="flex-1 rounded bg-ember px-3 py-1.5 text-center text-xs font-bold text-ember-ink hover:bg-ember-hover transition-colors"
        >
          Executar
        </Link>
      </div>
    </div>
  )
}
