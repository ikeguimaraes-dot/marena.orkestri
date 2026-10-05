'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Loader2 } from 'lucide-react'

export function AgendarVisita({ localId }: { localId: string }) {
  const [aberto, setAberto] = useState(false)
  const [data, setData] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  async function handleAgendar() {
    if (!data) { setErro('Selecione uma data.'); return }
    setSalvando(true)
    setErro('')
    try {
      const res = await fetch('/api/crivo/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ local_id: localId, agendado_para: `${data}T12:00:00Z` }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error ?? 'Erro ao agendar.'); return }
      setAberto(false)
      setData('')
      router.refresh()
    } finally {
      setSalvando(false)
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
      >
        <Calendar className="h-4 w-4" />
        Agendar Visita
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 space-y-3 w-full sm:w-auto">
      <p className="text-sm font-semibold text-ink">Agendar nova visita</p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={data}
          onChange={e => setData(e.target.value)}
          className="rounded-lg border border-edge-strong bg-base px-3 py-2 text-sm text-ink focus:outline-none focus:border-ember"
        />
        <button
          onClick={handleAgendar}
          disabled={salvando || !data}
          className="flex items-center gap-1.5 rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {salvando ? 'Agendando…' : 'Confirmar'}
        </button>
        <button
          onClick={() => { setAberto(false); setErro('') }}
          className="text-sm text-ink-muted hover:text-ink transition-colors"
        >
          Cancelar
        </button>
      </div>
      {erro && <p className="text-xs text-alert-bright">{erro}</p>}
    </div>
  )
}
