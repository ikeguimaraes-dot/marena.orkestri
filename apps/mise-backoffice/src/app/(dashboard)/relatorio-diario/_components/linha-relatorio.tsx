'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, X, RotateCcw } from 'lucide-react'
import { PERIODO_LABEL } from '@/app/api/relatorio-diario/_schema'

type Props = {
  data: string
  href: string
  labelDia: string
  cor: string
  label: string
  unitId: string
  periodosAtivos: string[]
  statusPorPeriodo: Record<string, string>
}

export function LinhaRelatorio({
  data, href, labelDia, cor, label, unitId, periodosAtivos, statusPorPeriodo,
}: Props) {
  const router = useRouter()
  const [local, setLocal] = useState(statusPorPeriodo)
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function toggleNA(periodo: string, aplicar: boolean) {
    setOcupado(periodo)
    try {
      const res = await fetch(`/api/relatorio-diario/${data}/periodos/${periodo}/na`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId, aplicar }),
      })
      if (res.ok) {
        setLocal(prev => ({ ...prev, [periodo]: aplicar ? 'nao_se_aplica' : 'rascunho' }))
        router.refresh()
      }
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-surface-raised/50 transition-colors">
      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cor}`} />
      <div className="flex-1 min-w-0">
        <Link href={href} className="text-sm font-medium text-ink hover:text-ember transition-colors">
          {labelDia}
        </Link>
        <div className="mt-1 flex flex-wrap gap-1">
          {periodosAtivos.map(p => {
            const st = local[p]
            const enviado = st === 'enviado'
            const na = st === 'nao_se_aplica'
            const carregando = ocupado === p
            return (
              <span
                key={p}
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  na
                    ? 'bg-edge/40 text-ink-faint line-through'
                    : enviado
                    ? 'bg-fresh/15 text-fresh-bright'
                    : 'bg-edge/40 text-ink-muted'
                } ${carregando ? 'opacity-50' : ''}`}
              >
                {PERIODO_LABEL[p] ?? p}
                {/* X para marcar N/A (só quando não enviado e não N/A) */}
                {!enviado && !na && (
                  <button
                    type="button"
                    onClick={() => toggleNA(p, true)}
                    disabled={carregando}
                    title="Marcar como não se aplica"
                    className="text-ink-faint hover:text-alert transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
                {/* Reverter N/A */}
                {na && (
                  <button
                    type="button"
                    onClick={() => toggleNA(p, false)}
                    disabled={carregando}
                    title="Reverter (voltar a aplicar)"
                    className="text-ink-faint hover:text-ember transition-colors no-underline"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      </div>
      <span className="text-xs text-ink-muted shrink-0">{label}</span>
      <Link href={href}>
        <ChevronRight className="h-4 w-4 text-ink-faint shrink-0" />
      </Link>
    </div>
  )
}
