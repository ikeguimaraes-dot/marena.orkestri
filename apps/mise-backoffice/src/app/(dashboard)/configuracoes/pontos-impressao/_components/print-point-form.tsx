'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Unit = { id: string; name: string }

type Initial = {
  id: string
  unit_id: string
  name: string
  icone: string | null
  rede: string | null
  ip_address: string | null
  ativo: boolean
}

export function PrintPointForm({ units, initial }: { units: Unit[]; initial?: Initial }) {
  const [unitId, setUnitId] = useState(initial?.unit_id ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [icone, setIcone] = useState(initial?.icone ?? '')
  const [rede, setRede] = useState(initial?.rede ?? '')
  const [ip, setIp] = useState(initial?.ip_address ?? '')
  const [ativo, setAtivo] = useState(initial?.ativo ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitId || !name.trim()) return
    setSaving(true)
    setError('')

    const payload: Record<string, string | boolean | null> = {
      unit_id: unitId,
      name: name.trim(),
      ativo,
    }
    if (icone.trim()) payload.icone = icone.trim()
    if (rede.trim()) payload.rede = rede.trim()
    if (ip.trim()) payload.ip_address = ip.trim()

    const url = initial ? `/api/print-points/${initial.id}` : '/api/print-points'
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

    router.push('/configuracoes/pontos-impressao')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1">Unidade *</label>
        <select value={unitId} onChange={e => setUnitId(e.target.value)} required
          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
          <option value="">Selecionar unidade</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1">Nome *</label>
        <input value={name} onChange={e => setName(e.target.value)} required placeholder="ex: Impressora Cozinha"
          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1">Ícone (emoji)</label>
        <input value={icone} onChange={e => setIcone(e.target.value)} placeholder="ex: 🖨️"
          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1">Rede</label>
        <input value={rede} onChange={e => setRede(e.target.value)} placeholder="ex: KPH-Interno"
          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1">Endereço IP</label>
        <input value={ip} onChange={e => setIp(e.target.value)} placeholder="ex: 192.168.1.100"
          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-ink-muted">Online</label>
        <button type="button" onClick={() => setAtivo(a => !a)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ativo ? 'bg-fresh' : 'bg-surface-hover'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-ink transition-transform ${ativo ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {error && <p className="text-sm text-alert-bright">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-50 transition-colors">
          {saving ? 'Salvando...' : initial ? 'Salvar alterações' : 'Criar ponto'}
        </button>
        <button type="button" onClick={() => router.push('/configuracoes/pontos-impressao')}
          className="rounded-lg border border-edge-strong px-4 py-2 text-sm text-ink-muted hover:text-ink transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}
