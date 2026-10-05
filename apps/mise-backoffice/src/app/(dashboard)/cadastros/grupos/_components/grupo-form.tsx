'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Group = { id: string; name: string }

export function GrupoForm({
  groups,
  initial,
}: {
  groups: Group[]
  initial?: { id: string; name: string; icone: string | null; parent_id: string | null }
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icone, setIcone] = useState(initial?.icone ?? '')
  const [parentId, setParentId] = useState(initial?.parent_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')

    const payload: Record<string, string | null> = { name: name.trim() }
    if (icone.trim()) payload.icone = icone.trim()
    if (parentId) payload.parent_id = parentId

    const url = initial ? `/api/grupos/${initial.id}` : '/api/grupos'
    const method = initial ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erro ao salvar grupo.')
      setSaving(false)
      return
    }

    router.push('/cadastros/grupos')
    router.refresh()
  }

  const availableParents = groups.filter(g => g.id !== initial?.id)

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1">Nome *</label>
        <input value={name} onChange={e => setName(e.target.value)} required placeholder="Nome do grupo"
          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ink-subtle focus:outline-none" />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1">Ícone (emoji)</label>
        <input value={icone} onChange={e => setIcone(e.target.value)} placeholder="ex: 🥩"
          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ink-subtle focus:outline-none" />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1">Subgrupo de</label>
        <select value={parentId} onChange={e => setParentId(e.target.value)}
          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
          <option value="">Sem grupo pai</option>
          {availableParents.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-alert-bright">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-50 transition-colors">
          {saving ? 'Salvando...' : initial ? 'Salvar alterações' : 'Criar grupo'}
        </button>
        <button type="button" onClick={() => router.push('/cadastros/grupos')}
          className="rounded-lg border border-edge-strong px-4 py-2 text-sm text-ink-muted hover:text-ink transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}
