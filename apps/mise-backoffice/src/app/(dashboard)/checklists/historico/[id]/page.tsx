import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, XCircle, Minus } from 'lucide-react'

function scoreColor(pct: number) {
  if (pct >= 80) return 'text-fresh'
  if (pct >= 60) return 'text-warn'
  return 'text-alert'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function renderResposta(resposta: Record<string, unknown> | null, tipo: string, opcoes: string[] | null): string {
  if (!resposta) return '—'
  switch (tipo) {
    case 'sim_nao': return resposta.valor === 'sim' ? '✓ Conforme' : '✗ Não conforme'
    case 'data': return String(resposta.data ?? '—')
    case 'selecao': return String(resposta.valor ?? '—')
    case 'checklist_multiplo': {
      const sel = Array.isArray(resposta.selecionados) ? resposta.selecionados as string[] : []
      const total = Array.isArray(opcoes) ? opcoes.length : 0
      return `${sel.length}/${total} marcados`
    }
    case 'assinatura': return resposta.assinatura ? '✓ Assinado' : '—'
    case 'texto': return String(resposta.texto ?? '—')
    default: return JSON.stringify(resposta)
  }
}

export default async function ChecklistExecucaoRelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: execucao, error } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !execucao) notFound()

  const [
    { data: template },
    { data: items },
    { data: respostas },
    { data: units },
  ] = await Promise.all([
    supabase.schema('mise').from('checklist_templates').select('*').eq('id', execucao.template_id).single(),
    supabase.schema('mise').from('checklist_template_items').select('*').eq('template_id', execucao.template_id).order('ordem'),
    supabase.schema('mise').from('checklist_responses').select('*').eq('execution_id', id),
    supabase.from('units').select('id, name'),
  ])

  const unitsMap = Object.fromEntries((units ?? []).map(u => [u.id, u.name]))
  const respostasMap = Object.fromEntries((respostas ?? []).map(r => [r.item_id, r]))

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <Link href="/checklists/historico" className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink-muted mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Histórico
        </Link>

        <div className="rounded-lg border border-edge bg-surface p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-ink">{template?.nome ?? 'Relatório de Execução'}</h1>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-ink-muted">
                <span>📅 {execucao.concluido_em ? fmtDate(execucao.concluido_em) : fmtDate(execucao.iniciado_em)}</span>
                {execucao.turno && <span>🕐 {execucao.turno}</span>}
                <span>🏠 {unitsMap[execucao.unit_id] ?? '—'}</span>
              </div>
            </div>
            <div className="text-center shrink-0">
              <div className={`text-4xl font-black ${scoreColor(execucao.percentual)}`}>
                {execucao.percentual.toFixed(0)}%
              </div>
              <div className="text-xs text-ink-subtle mt-0.5">
                {Number(execucao.pontuacao_obtida).toFixed(1)}/{execucao.pontuacao_total} pts
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-edge bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-edge">
          <span className="text-sm font-semibold text-ink">Respostas</span>
        </div>
        <div className="divide-y divide-edge/60">
          {(items ?? []).map(item => {
            const r = respostasMap[item.id]
            const isNa = r?.nao_aplicavel
            const conforme = r?.resposta?.valor === 'sim'
            const naoConforme = item.tipo_resposta === 'sim_nao' && r?.resposta?.valor === 'nao'
            return (
              <div key={item.id} className={`px-4 py-3 flex gap-3 ${isNa ? 'opacity-50' : ''}`}>
                <div className="mt-0.5 shrink-0">
                  {isNa ? (
                    <Minus className="h-4 w-4 text-ink-subtle" />
                  ) : conforme ? (
                    <CheckCircle2 className="h-4 w-4 text-fresh-bright" />
                  ) : naoConforme ? (
                    <XCircle className="h-4 w-4 text-alert-bright" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-ink-faint" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{item.titulo}</p>
                  {r ? (
                    <>
                      <p className={`text-xs mt-0.5 ${naoConforme ? 'text-alert-bright' : 'text-ink-muted'}`}>
                        {isNa ? 'Não aplicável' : renderResposta(r.resposta, item.tipo_resposta, item.opcoes as string[] | null)}
                      </p>
                      {r.comentario && (
                        <p className="text-xs mt-1 text-ink-subtle italic">&quot;{r.comentario}&quot;</p>
                      )}
                      {item.tipo_resposta === 'checklist_multiplo' && Array.isArray(r.resposta?.selecionados) && (
                        <ul className="mt-1 space-y-0.5">
                          {(item.opcoes as string[] ?? []).map((op, i) => {
                            const checked = (r.resposta!.selecionados as string[]).includes(op)
                            return (
                              <li key={i} className={`text-xs flex items-center gap-1.5 ${checked ? 'text-fresh-bright' : 'text-ink-faint line-through'}`}>
                                <span>{checked ? '☑' : '☐'}</span> {op}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      {r.foto_url && (
                        <a href={r.foto_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
                          <img
                            src={r.foto_url}
                            alt="Foto do item"
                            className="h-16 w-16 object-cover rounded-lg border border-edge hover:border-edge-strong transition-colors"
                          />
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-ink-faint mt-0.5">Sem resposta</p>
                  )}
                </div>
                {item.peso > 0 && (
                  <span className="text-[10px] text-ink-faint shrink-0 mt-0.5">{item.peso}pt</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
