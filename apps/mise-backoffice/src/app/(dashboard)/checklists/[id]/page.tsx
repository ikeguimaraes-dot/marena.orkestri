import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import { TemplateDetailClient } from './_components/template-detail-client'

const TIPO_LABEL: Record<string, string> = {
  abertura: 'Abertura', fechamento: 'Fechamento', rotina: 'Rotina',
  relatorio: 'Relatório', treinamento: 'Treinamento',
}

const TIPO_RESPOSTA_LABEL: Record<string, string> = {
  sim_nao: 'Sim / Não',
  data: 'Data',
  selecao: 'Seleção',
  checklist_multiplo: 'Checklist múltiplo',
  assinatura: 'Assinatura',
  texto: 'Texto livre',
}

export default async function ChecklistTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: template }, { data: items }, { data: units }] = await Promise.all([
    supabase.schema('mise').from('checklist_templates').select('*').eq('id', id).single(),
    supabase.schema('mise').from('checklist_template_items').select('*').eq('template_id', id).order('ordem'),
    supabase.from('units').select('id, name').eq('active', true),
  ])

  if (!template) notFound()

  const unitsMap = Object.fromEntries((units ?? []).map(u => [u.id, u.name]))

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <Link href="/checklists" className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink-muted mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Checklists
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-ink-muted" />
              {template.nome}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {template.tipo && (
                <span className="rounded px-2 py-0.5 text-xs font-semibold bg-surface-raised text-ink-muted">
                  {TIPO_LABEL[template.tipo] ?? template.tipo}
                </span>
              )}
              {template.departamento && (
                <span className="rounded px-2 py-0.5 text-xs bg-surface-raised text-ink-muted">
                  {template.departamento}
                </span>
              )}
              {template.unit_id && (
                <span className="rounded px-2 py-0.5 text-xs bg-surface-raised text-ink-muted">
                  {unitsMap[template.unit_id] ?? template.unit_id}
                </span>
              )}
            </div>
          </div>
          <TemplateDetailClient templateId={id} unitId={template.unit_id} />
        </div>
      </div>

      <div className="rounded-lg border border-edge bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-edge flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">{items?.length ?? 0} itens</span>
        </div>
        <div className="divide-y divide-edge/60">
          {(items ?? []).map(item => (
            <div key={item.id} className="px-4 py-3 flex items-start gap-3">
              <span className="mt-0.5 min-w-[1.5rem] text-right text-xs font-mono text-ink-faint">{item.ordem}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink font-medium">{item.titulo}</p>
                {item.descricao && <p className="text-xs text-ink-subtle mt-0.5">{item.descricao}</p>}
                {item.tipo_resposta === 'checklist_multiplo' && Array.isArray(item.opcoes) && (
                  <ul className="mt-1.5 space-y-0.5">
                    {(item.opcoes as string[]).map((op, i) => (
                      <li key={i} className="text-xs text-ink-subtle flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-ink-faint" />
                        {op}
                      </li>
                    ))}
                  </ul>
                )}
                {item.tipo_resposta === 'selecao' && Array.isArray(item.opcoes) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(item.opcoes as string[]).map((op, i) => (
                      <span key={i} className="rounded border border-edge-strong px-1.5 py-0.5 text-[10px] text-ink-muted">{op}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-surface-raised text-ink-muted">
                  {TIPO_RESPOSTA_LABEL[item.tipo_resposta]}
                </span>
                {item.peso === 0 && (
                  <span className="text-[10px] text-ink-faint">Sem peso</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
