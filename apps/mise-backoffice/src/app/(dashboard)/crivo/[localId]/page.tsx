import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play } from 'lucide-react'
import { AgendarVisita } from './_components/agendar-visita'

const CATEGORIA_LABEL: Record<string, string> = {
  documentacao: 'Documentação',
  operacional: 'Operacional',
  estrutural: 'Estrutural',
  inspecao_higiene: 'Inspeção e Higiene',
  manutencao: 'Manutenção',
}

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
}

const STATUS_COR: Record<string, string> = {
  agendado: 'bg-edge/40 text-ink-muted',
  em_andamento: 'bg-warn/15 text-warn-bright',
  concluido: 'bg-fresh/15 text-fresh-bright',
}

function fmtData(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  })
}

function corPct(pct: number): string {
  if (pct >= 75) return 'text-fresh-bright'
  if (pct >= 50) return 'text-warn-bright'
  return 'text-alert-bright'
}

type Execucao = {
  id: string
  template_id: string
  status: string
  percentual: number | null
  agendado_para: string | null
  iniciado_em: string | null
  categoria: string | null
}

function agruparPorVisita(execucoes: Execucao[]): Map<string, Execucao[]> {
  const map = new Map<string, Execucao[]>()
  for (const ex of execucoes) {
    const chave = (ex.agendado_para ?? ex.iniciado_em ?? '').slice(0, 10)
    if (!chave) continue
    const arr = map.get(chave) ?? []
    arr.push(ex)
    map.set(chave, arr)
  }
  return map
}

export default async function CrivoLocalPage({
  params,
}: {
  params: Promise<{ localId: string }>
}) {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const { localId } = await params
  const supabase = createServiceClient()

  const [{ data: local }, { data: templates }] = await Promise.all([
    supabase.schema('mise').from('crivo_locais').select('id, nome, unit_id').eq('id', localId).single(),
    supabase.schema('mise').from('checklist_templates')
      .select('id, categoria')
      .eq('modulo', 'CRIVO')
      .eq('ativo', true),
  ])

  if (!local) notFound()

  const templateIds = (templates ?? []).map(t => t.id)
  const catMap = new Map((templates ?? []).map(t => [t.id, t.categoria as string | null]))

  const { data: execucoesRaw } = templateIds.length
    ? await supabase.schema('mise').from('checklist_executions')
        .select('id, template_id, status, percentual, agendado_para, iniciado_em')
        .eq('local_id', localId)
        .order('agendado_para', { ascending: false, nullsFirst: false })
        .order('iniciado_em', { ascending: false, nullsFirst: false })
    : { data: [] }

  const execucoes: Execucao[] = (execucoesRaw ?? []).map(ex => ({
    ...ex,
    categoria: catMap.get(ex.template_id) ?? null,
  }))

  const visitasPorData = agruparPorVisita(execucoes)
  const datasOrdenadas = Array.from(visitasPorData.keys()).sort((a, b) => b.localeCompare(a))

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/crivo" className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink-muted mb-3 w-fit">
          <ArrowLeft className="h-3.5 w-3.5" /> CRIVO
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">{local.nome}</h1>
            <p className="text-sm text-ink-muted">Histórico de visitas</p>
          </div>
          <AgendarVisita localId={localId} />
        </div>
      </div>

      {datasOrdenadas.length === 0 ? (
        <div className="rounded-xl border border-edge bg-surface p-10 text-center">
          <p className="text-sm text-ink-muted">Nenhuma visita registrada ainda.</p>
          <p className="text-xs text-ink-faint mt-1">Use o botão acima para agendar a primeira visita.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {datasOrdenadas.map(data => {
            const exs = visitasPorData.get(data)!
            const todasConcluidas = exs.every(e => e.status === 'concluido')
            const scoreMedio = todasConcluidas && exs.every(e => e.percentual != null)
              ? exs.reduce((s, e) => s + (e.percentual ?? 0), 0) / exs.length
              : null

            return (
              <div key={data} className="rounded-xl border border-edge bg-surface overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-edge/60">
                  <span className="text-sm font-semibold text-ink capitalize">{fmtData(data)}</span>
                  {scoreMedio != null && (
                    <span className={`text-sm font-bold ${corPct(scoreMedio)}`}>
                      {scoreMedio.toFixed(0)}% geral
                    </span>
                  )}
                </div>
                <div className="divide-y divide-edge/40">
                  {exs.map(ex => (
                    <div key={ex.id} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink">
                          {CATEGORIA_LABEL[ex.categoria ?? ''] ?? ex.categoria ?? 'Auditoria'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COR[ex.status] ?? 'bg-edge/40 text-ink-muted'}`}>
                            {STATUS_LABEL[ex.status] ?? ex.status}
                          </span>
                          {ex.status === 'concluido' && ex.percentual != null && (
                            <span className={`text-xs font-semibold ${corPct(ex.percentual)}`}>
                              {Number(ex.percentual).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                      {ex.status !== 'concluido' && (
                        <Link
                          href={`/crivo/execucao/${ex.id}`}
                          className="flex items-center gap-1 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink hover:border-ember transition-colors shrink-0"
                        >
                          <Play className="h-3 w-3" />
                          {ex.status === 'agendado' ? 'Iniciar' : 'Continuar'}
                        </Link>
                      )}
                    </div>
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
