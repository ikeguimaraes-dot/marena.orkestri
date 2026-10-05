'use client'

import { Bluetooth } from 'lucide-react'
import { buildTSPL, tsplToBase64 } from '@/lib/etiqueta-tspl'

export function BotaoReimprimir({
  id,
  nome,
  metodo,
  dataManipulacao,
  validade,
  respNome,
}: {
  id: string
  nome: string
  metodo: string | null
  dataManipulacao: string
  validade: string
  respNome: string
}) {
  function handleReprint() {
    const tspl = buildTSPL({
      nome,
      metodo,
      dataManipulacao,
      validade,
      respNome,
      id,
      quantidade: 1,
    })
    const b64 = tsplToBase64(tspl)
    const url = `miseprint://print?data=${encodeURIComponent(b64)}`
    window.location.href = url
  }

  return (
    <button
      type="button"
      onClick={handleReprint}
      className="flex items-center gap-1.5 rounded-lg border border-edge-strong px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
    >
      <Bluetooth className="h-3.5 w-3.5" />
      Reimprimir
    </button>
  )
}
