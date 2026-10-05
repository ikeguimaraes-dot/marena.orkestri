'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Employee = {
  id: string
  nome: string
}

const AVATAR_COLORS = [
  'bg-fresh', 'bg-info', 'bg-purple-600', 'bg-orange-600',
  'bg-alert', 'bg-cyan-600', 'bg-pink-600', 'bg-yellow-600',
]

function getColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(nome: string) {
  const parts = nome.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function PinLoginClient({ employees }: { employees: Employee[] }) {
  const [selected, setSelected] = useState<Employee | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function handleSelectEmployee(emp: Employee) {
    setSelected(emp)
    setPin('')
    setError('')
  }

  async function handleDigit(d: string) {
    if (loading) return
    const next = pin + d
    setPin(next)
    setError('')

    if (next.length === 4) {
      setLoading(true)
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: selected!.id, pin: next }),
      })
      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'PIN incorreto')
        setPin('')
        setLoading(false)
      }
    }
  }

  function handleBackspace() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  if (!selected) {
    return (
      <div className="min-h-screen bg-base px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-ink">MISE</h1>
            <p className="mt-1 text-sm text-ink-muted">Quem está entrando?</p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => handleSelectEmployee(emp)}
                className="flex flex-col items-center gap-2 rounded-xl border border-edge bg-surface p-4 text-center transition-colors hover:border-ember hover:bg-surface-raised min-h-[80px]"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-ink ${getColor(emp.id)}`}>
                  {getInitials(emp.nome)}
                </div>
                <span className="text-xs font-medium text-ink-muted leading-tight">{emp.nome.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-4">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center">
          <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-ink ${getColor(selected.id)}`}>
            {getInitials(selected.nome)}
          </div>
          <p className="text-sm font-medium text-ink">{selected.nome}</p>
          <p className="text-xs text-ink-subtle">Digite seu PIN de 4 dígitos</p>
        </div>

        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full transition-colors ${i < pin.length ? 'bg-ember' : 'bg-surface-hover'}`}
            />
          ))}
        </div>

        {error && <p className="text-center text-sm text-alert-bright">{error}</p>}

        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              disabled={loading || pin.length >= 4}
              className="flex h-16 items-center justify-center rounded-xl border border-edge bg-surface text-xl font-semibold text-ink transition-colors hover:bg-surface-raised active:bg-surface-hover disabled:opacity-40"
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => { setSelected(null); setPin(''); setError('') }}
            className="flex h-16 items-center justify-center rounded-xl border border-edge bg-surface text-xs font-medium text-ink-muted transition-colors hover:bg-surface-raised"
          >
            Trocar
          </button>
          <button
            onClick={() => handleDigit('0')}
            disabled={loading || pin.length >= 4}
            className="flex h-16 items-center justify-center rounded-xl border border-edge bg-surface text-xl font-semibold text-ink transition-colors hover:bg-surface-raised active:bg-surface-hover disabled:opacity-40"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={loading || pin.length === 0}
            className="flex h-16 items-center justify-center rounded-xl border border-edge bg-surface text-sm font-medium text-ink-muted transition-colors hover:bg-surface-raised disabled:opacity-40"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  )
}
