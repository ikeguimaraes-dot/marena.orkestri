'use client'

import { useState } from 'react'

export function EmployeeToggle({ id, miseAtivo }: { id: string; miseAtivo: boolean }) {
  const [active, setActive] = useState(miseAtivo)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    const next = !active
    setActive(next)
    setLoading(true)
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mise_ativo: next }),
    })
    if (!res.ok) setActive(!next)
    setLoading(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
        active ? 'bg-fresh' : 'bg-surface-hover'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-ink transition-transform ${
        active ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}
