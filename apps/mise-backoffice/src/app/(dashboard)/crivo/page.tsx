import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, ChevronRight, Plus, BarChart2 } from 'lucide-react'

const CATEGORIA_LABEL: Record<string, string> = {
  documentacao: 'Documentação',
  operacional: 'Operacional',
  estrutural: 'Estrutural',
  inspecao_higiene: 'Inspeção e Higiene',
  manutencao: 'Manutenção',
}

function fmtData(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  })
}

function corPct(pct: number | null): string {
  if (pct == null) return 'text-ink-faint'
  if (pct >= 75) return 'text-fresh-bright'
  if (pct >= 50) return 'text-warn-bright'
  return 'text-alert-bright'
}

export default async function CrivoPage() {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const supabase = createServiceClient()

  const [{ data: locais }, { data: templates }] = await Promise.all([
    supabase.schema('mise').from('crivo_locais').select('id, nome, unit_id').eq('ativo', true).order('nome'),
    supabase.schema('mise').from('checklist_templates')
      .select('id, categoria')
      .eq('modulo', 'CRIVO')
      .eq('ativo', true),
  ])

  const templateIds = (templates ?? []).map(t => t.id)
  const catMap = new Map((templates ?? []).map(t => [t.id, t.categoria as string | null]))

  const { data: execucoes } = templateIds.length
    ? await supabase.schema('mise').from('checklist_executions')
        .select('local_id, template_id, percentual, concluido_em')
        .in('template_id', templateIds)
        .eq('status', 'concluido')
        .not('local_id', 'is', null)
        .order('concluido_em', { ascending: false })
    : { data: [] }

  // local_id → categoria → { percentual, data }
  const scoreMap = new Map<string, Map<string, { percentual: number | null; data: string }>>()
  for (const ex of execucoes ?? []) {
    const cat = catMap.get(ex.template_id)
    if (!cat || !ex.local_id) continue
    const localMap = scoreMap.get(ex.local_id) ?? new Map()
    if (!localMap.has(cat)) {
      localMap.set(cat, { percentual: ex.percentual, data: ex.concluido_em?.slice(0, 10) ?? '' })
    }
    scoreMap.set(ex.local_id, localMap)
  }

  // Distinct categories present in templates (preserve insert order)
  const categoriasAtivas = [...new Set((templates ?? []).map(t => t.categoria).filter(Boolean) as string[])]

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-ink-muted" />
            CRIVO
          </h1>
          <p className="text-sm text-ink-muted">Auditorias por local</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/crivo/relatorios"
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Relatórios
          </Link>
          <Link
            href="/crivo/templates"
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Templates
          </Link>
        </div>
      </div>

      {(locais ?? []).length === 0 ? (
        <div className="rounded-xl border border-edge bg-surface p-10 text-center">
          <p className="text-sm text-ink-muted">Nenhum local cadastrado.</p>
          <p className="text-xs text-ink-faint mt-1">Cadastre locais diretamente no banco de dados (tabela crivo_locais).</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(locais ?? []).map(local => {
            const localScores = scoreMap.get(local.id)
            const ultimaVisita = categoriasAtivas.map(c => localScores?.get(c)?.data).find(Boolean) ?? null

            return (
              <Link
                key={local.id}
                href={`/crivo/${local.id}`}
                className="rounded-xl border border-edge bg-surface p-4 hover:bg-surface-raised/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-ink text-sm leading-tight">{local.nome}</span>
                  <ChevronRight className="h-4 w-4 text-ink-faint shrink-0" />
                </div>
                <div className="space-y-1.5">
                  {categoriasAtivas.map(cat => {
                    const score = localScores?.get(cat)
                    const pct = score?.percentual
                    return (
                      <div key={cat} className="flex items-center justify-between text-xs">
                        <span className="text-ink-muted">{CATEGORIA_LABEL[cat] ?? cat}</span>
                        <span className={`font-semibold ${corPct(pct ?? null)}`}>
                          {pct != null ? `${Number(pct).toFixed(0)}%` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {ultimaVisita && (
                  <p className="mt-2.5 text-[10px] text-ink-faint">Última visita: {fmtData(ultimaVisita)}</p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
