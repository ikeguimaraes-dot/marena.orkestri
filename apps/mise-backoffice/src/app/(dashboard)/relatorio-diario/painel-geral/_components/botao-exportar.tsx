'use client'

import { Printer } from 'lucide-react'

export function BotaoExportar() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-sm text-ink-muted hover:text-ink hover:border-edge-strong transition-colors"
    >
      <Printer className="h-4 w-4" />
      Exportar
    </button>
  )
}
