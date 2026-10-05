'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

type Unit = { id: string; name: string }

type Initial = {
  id: string
  nome: string
  ativo: boolean
  unit_ids: string[]
}

export function ResponsavelForm({ units, initial }: { units: Unit[]; initial?: Initial }) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [ativo, setAtivo] = useState(initial?.ativo ?? true)
  const [unitIds, setUnitIds] = useState<string[]>(initial?.unit_ids ?? [])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function toggleUnit(unitId: string) {
    setUnitIds(prev => prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setSaving(true)
    setError('')

    const payload = { nome: nome.trim(), ativo, unit_ids: unitIds }
    const url = initial ? `/api/responsaveis/${initial.id}` : '/api/responsaveis'
    const method = initial ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erro ao salvar.')
      setSaving(false)
      return
    }

    router.push('/cadastros/responsaveis')
    router.refresh()
  }

  async function handleDelete() {
    if (!initial) return
    if (!confirm(`Remover "${initial.nome}"? As etiquetas já geradas por essa pessoa preservam o nome no histórico.`)) return
    setDeleting(true)
    setError('')

    const res = await fetch(`/api/responsaveis/${initial.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erro ao remover.')
      setDeleting(false)
      return
    }

    router.push('/cadastros/responsaveis')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1">Nome *</label>
        <input value={nome} onChange={e => setNome(e.target.value)} required placeholder="Nome do responsável"
          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ink-subtle focus:outline-none" />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-muted mb-2">Unidades</label>
        {units.length === 0 ? (
          <p className="text-sm text-ink-subtle">Nenhuma unidade ativa encontrada.</p>
        ) : (
          <div className="space-y-2">
            {units.map(u => (
              <label key={u.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={unitIds.includes(u.id)}
                  onChange={() => toggleUnit(u.id)}
                  className="h-4 w-4 rounded border-edge-strong accent-ember"
                />
                {u.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {initial && (
        <div className="flex items-center gap-3">
          <label className="text-sm text-ink-muted">Ativo</label>
          <button type="button" onClick={() => setAtivo(a => !a)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ativo ? 'bg-fresh' : 'bg-surface-hover'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-ink transition-transform ${ativo ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      )}

      {error && <p className="text-sm text-alert-bright">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-50 transition-colors">
            {saving ? 'Salvando...' : initial ? 'Salvar alterações' : 'Criar responsável'}
          </button>
          <button type="button" onClick={() => router.push('/cadastros/responsaveis')}
            className="rounded-lg border border-edge-strong px-4 py-2 text-sm text-ink-muted hover:text-ink transition-colors">
            Cancelar
          </button>
        </div>
        {initial && (
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg border border-alert/40 px-3 py-2 text-sm text-alert-bright hover:bg-alert/10 disabled:opacity-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? 'Removendo...' : 'Remover'}
          </button>
        )}
      </div>
    </form>
  )
}
