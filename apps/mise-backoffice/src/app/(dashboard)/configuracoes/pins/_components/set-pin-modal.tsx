'use client'

import { useState } from 'react'

type Employee = { id: string; nome: string }

export function SetPinModal({ employee, onClose, onSuccess }: {
  employee: Employee
  onClose: () => void
  onSuccess: () => void
}) {
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [role, setRole] = useState<'cozinheiro' | 'gerente' | 'admin'>('cozinheiro')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('PIN deve ter 4 dígitos numéricos.')
      return
    }
    if (pin !== pinConfirm) {
      setError('PINs não coincidem.')
      return
    }
    setSaving(true)
    setError('')

    const res = await fetch('/api/auth/set-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employee.id, pin, role }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erro ao salvar PIN.')
      setSaving(false)
      return
    }

    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-edge bg-surface p-6 space-y-4">
        <h2 className="font-semibold text-ink">PIN — {employee.nome}</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Nível de acesso</label>
            <select value={role} onChange={e => setRole(e.target.value as typeof role)}
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
              <option value="cozinheiro">Cozinheiro</option>
              <option value="gerente">Gerente</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">PIN (4 dígitos)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none tracking-widest"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Confirmar PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinConfirm}
              onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none tracking-widest"
            />
          </div>

          {error && <p className="text-sm text-alert-bright">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : 'Definir PIN'}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-lg border border-edge-strong px-4 py-2 text-sm text-ink-muted hover:text-ink transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
