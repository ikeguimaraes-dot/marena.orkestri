'use client'

import { useState, useEffect } from 'react'
import { SetPinModal } from './_components/set-pin-modal'

type Employee = { id: string; nome: string; departamento: string | null }
type PinData = { employee_id: string; role: string }

export default function PinsPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [pins, setPins] = useState<PinData[]>([])
  const [loading, setLoading] = useState(true)
  const [modalEmp, setModalEmp] = useState<Employee | null>(null)

  async function load() {
    setLoading(true)
    const [empRes, pinRes] = await Promise.all([
      fetch('/api/employees/mise-ativos'),
      fetch('/api/auth/pins-list'),
    ])
    if (empRes.ok) setEmployees(await empRes.json())
    if (pinRes.ok) setPins(await pinRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const pinsMap = Object.fromEntries(pins.map(p => [p.employee_id, p.role]))
  const comPin = employees.filter(e => pinsMap[e.id])
  const semPin = employees.filter(e => !pinsMap[e.id])

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-ink-muted">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">PINs de Acesso</h1>
        <p className="text-sm text-ink-muted">Gerencie os PINs dos funcionários</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Total', value: employees.length, color: 'text-ink' },
          { label: 'Com PIN', value: comPin.length, color: 'text-fresh' },
          { label: 'Sem PIN', value: semPin.length, color: 'text-warn' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-edge bg-surface p-4">
            <p className="text-xs font-medium text-ink-muted">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-edge bg-surface">
        <div className="border-b border-edge px-5 py-4">
          <p className="text-sm font-semibold text-ink">Funcionários MISE ativos</p>
        </div>
        <div className="divide-y divide-edge">
          {employees.map(e => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-ink">{e.nome}</p>
                <p className="text-xs text-ink-subtle">
                  {e.departamento ?? '—'} ·{' '}
                  {pinsMap[e.id]
                    ? <span className="text-fresh-bright">PIN definido · {pinsMap[e.id]}</span>
                    : <span className="text-warn-bright">Sem PIN</span>
                  }
                </p>
              </div>
              <button
                onClick={() => setModalEmp(e)}
                className="rounded border border-edge-strong px-3 py-1 text-xs text-ink-muted hover:text-ink transition-colors"
              >
                {pinsMap[e.id] ? 'Alterar PIN' : 'Definir PIN'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {modalEmp && (
        <SetPinModal
          employee={modalEmp}
          onClose={() => setModalEmp(null)}
          onSuccess={() => { setModalEmp(null); load() }}
        />
      )}
    </div>
  )
}
