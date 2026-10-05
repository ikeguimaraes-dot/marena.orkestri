import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const CATEGORIA_LABEL: Record<string, string> = {
  documentacao: 'Documentação',
  operacional: 'Operacional',
  estrutural: 'Estrutural',
  inspecao_higiene: 'Inspeção e Higiene',
  manutencao: 'Manutenção',
}

function classificar(pct: number): string {
  if (pct < 50) return 'Crítico'
  if (pct < 60) return 'Ruim'
  if (pct < 75) return 'Regular'
  if (pct < 90) return 'Bom'
  return 'Excelente'
}

function cellColor(pct: number): string {
  if (pct < 50) return 'bg-alert/15 text-alert-bright'
  if (pct < 60) return 'bg-orange-400/15 text-orange-600'
  if (pct < 75) return 'bg-warn/20 text-warn-bright'
  if (pct < 90) return 'bg-fresh/15 text-fresh-bright'
  return 'bg-fresh/30 text-fresh-bright font-bold'
}

function fmtDataCurta(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', timeZone: 'UTC',
  })
}

export default async function CrivoRelatoriosPage() {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const supabase = createServiceClient()

  const [{ data: locais }, { data: templates }, { data: execucoes }] = await Promise.all([
    supabase.schema('mise').from('crivo_locais').select('id, nome').eq('ativo', true).order('nome'),
    supabase.schema('mise').from('checklist_templates')
      .select('id, categoria, nome')
      .eq('modulo', 'CRIVO')
      .eq('ativo', true),
    supabase.schema('mise').from('checklist_executions')
      .select('id, local_id, template_id, percentual, agendado_para, concluido_em')
      .eq('status', 'concluido')
      .not('local_id', 'is', null)
      .order('agendado_para', { ascending: false }),
  ])

  // templateId → categoria
  const templateCatMap = new Map((templates ?? []).map(t => [t.id, t.categoria as string | null]))

  type Cell = { percentual: number }
  // categoria → localId → date → Cell
  const pivot = new Map<string, Map<string, Map<string, Cell>>>()

  for (const ex of execucoes ?? []) {
    if (!ex.local_id || ex.percentual == null) continue
    const cat = templateCatMap.get(ex.template_id)
    if (!cat) continue
    const date = (ex.agendado_para ?? ex.concluido_em ?? '').slice(0, 10)
    if (!date) continue

    if (!pivot.has(cat)) pivot.set(cat, new Map())
    const localMap = pivot.get(cat)!
    if (!localMap.has(ex.local_id)) localMap.set(ex.local_id, new Map())
    const dateMap = localMap.get(ex.local_id)!
    if (!dateMap.has(date)) dateMap.set(date, { percentual: ex.percentual })
  }

  // All distinct dates sorted descending
  const todasDatas = [...new Set((execucoes ?? [])
    .map(ex => (ex.agendado_para ?? ex.concluido_em ?? '').slice(0, 10))
    .filter(Boolean)
  )].sort((a, b) => b.localeCompare(a))

  const categoriasPresentes = [...new Set((templates ?? [])
    .map(t => t.categoria)
    .filter((c): c is string => !!c)
  )]

  const locaisAtivos = locais ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <Link href="/crivo" className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink-muted mb-3 w-fit">
          <ArrowLeft className="h-3.5 w-3.5" /> CRIVO
        </Link>
        <h1 className="text-xl font-bold text-ink">Relatórios CRIVO</h1>
        <p className="text-sm text-ink-muted">Evolução histórica por local e tipo de auditoria</p>
      </div>

      {categoriasPresentes.length === 0 || todasDatas.length === 0 ? (
        <div className="rounded-xl border border-edge bg-surface p-10 text-center">
          <p className="text-sm text-ink-muted">Nenhuma auditoria concluída ainda.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {categoriasPresentes.map(cat => {
            const catData = pivot.get(cat)
            // Dates that have at least one result for this category
            const datasDosCat = todasDatas.filter(d =>
              locaisAtivos.some(l => catData?.get(l.id)?.has(d))
            )
            if (datasDosCat.length === 0) return null

            return (
              <div key={cat}>
                <h2 className="text-sm font-semibold text-ink mb-3">
                  {CATEGORIA_LABEL[cat] ?? cat}
                </h2>
                <div className="overflow-x-auto rounded-xl border border-edge">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-edge bg-surface-raised">
                        <th className="px-4 py-2.5 text-left font-semibold text-ink-subtle min-w-[160px]">Local</th>
                        {datasDosCat.map(d => (
                          <th key={d} className="px-3 py-2.5 text-center font-semibold text-ink-subtle whitespace-nowrap min-w-[64px]">
                            {fmtDataCurta(d)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-edge/40">
                      {locaisAtivos.map(local => {
                        const localData = catData?.get(local.id)
                        const hasAny = datasDosCat.some(d => localData?.has(d))
                        if (!hasAny) return null

                        return (
                          <tr key={local.id} className="hover:bg-surface-raised/30">
                            <td className="px-4 py-2.5 font-medium text-ink">
                              <Link href={`/crivo/${local.id}`} className="hover:text-ember">
                                {local.nome}
                              </Link>
                            </td>
                            {datasDosCat.map(d => {
                              const cell = localData?.get(d)
                              return (
                                <td key={d} className="px-2 py-2 text-center">
                                  {cell ? (
                                    <span
                                      className={`inline-block rounded px-2 py-1 text-[11px] font-semibold ${cellColor(cell.percentual)}`}
                                      title={classificar(cell.percentual)}
                                    >
                                      {Number(cell.percentual).toFixed(0)}%
                                    </span>
                                  ) : (
                                    <span className="text-ink-faint">—</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Legenda */}
                <div className="flex flex-wrap gap-3 mt-2">
                  {[
                    { label: 'Crítico', color: 'bg-alert/15 text-alert-bright', range: '< 50%' },
                    { label: 'Ruim', color: 'bg-orange-400/15 text-orange-600', range: '50–60%' },
                    { label: 'Regular', color: 'bg-warn/20 text-warn-bright', range: '60–75%' },
                    { label: 'Bom', color: 'bg-fresh/15 text-fresh-bright', range: '75–90%' },
                    { label: 'Excelente', color: 'bg-fresh/30 text-fresh-bright', range: '≥ 90%' },
                  ].map(({ label, color, range }) => (
                    <span key={label} className={`rounded px-2 py-0.5 text-[10px] font-medium ${color}`}>
                      {label} ({range})
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
