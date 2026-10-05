import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ClipboardCheck, Plus } from 'lucide-react'
import { TemplateCard } from './_components/template-card'

export default async function ChecklistsPage() {
  const supabase = createServiceClient()

  const [
    { data: templates, error: errTemplates },
    { data: items, error: errItems },
    { data: lastExecs, error: errExecs },
    { data: units, error: errUnits },
  ] = await Promise.all([
    supabase.schema('mise').from('checklist_templates').select('*').eq('ativo', true).eq('modulo', 'RITMO').order('nome'),
    supabase.schema('mise').from('checklist_template_items').select('template_id', { count: 'exact' }),
    supabase.schema('mise').from('checklist_executions').select('template_id, percentual, concluido_em').eq('status', 'concluido').order('concluido_em', { ascending: false }),
    supabase.from('units').select('id, name').eq('active', true),
  ])

  console.error('MISE DEBUG templates:', errTemplates)
  console.error('MISE DEBUG items:', errItems)
  console.error('MISE DEBUG execs:', errExecs)
  console.error('MISE DEBUG units:', errUnits)

  // Count items per template
  const itemCountMap: Record<string, number> = {}
  for (const it of (items ?? [])) {
    itemCountMap[it.template_id] = (itemCountMap[it.template_id] ?? 0) + 1
  }

  // Last score per template
  const lastScoreMap: Record<string, number | null> = {}
  for (const ex of (lastExecs ?? [])) {
    if (!(ex.template_id in lastScoreMap)) {
      lastScoreMap[ex.template_id] = ex.percentual
    }
  }

  const unitsMap = Object.fromEntries((units ?? []).map(u => [u.id, u.name]))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-ink-muted" />
            Checklists
          </h1>
          <p className="mt-2 text-sm text-ink-muted">Uma etapa de cada vez. Uma cozinha pronta para o serviço.</p>
        </div>
        <Link
          href="/checklists/novo"
          className="flex items-center gap-2 rounded-md bg-ember px-4 py-2 text-sm font-medium text-ember-ink hover:bg-ember-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Checklist
        </Link>
      </div>

      {!templates || templates.length === 0 ? (
        <div className="rounded-lg border border-edge bg-surface p-12 text-center">
          <ClipboardCheck className="mx-auto h-10 w-10 text-ink-faint mb-3" />
          <p className="text-ink-muted">Nenhum checklist cadastrado.</p>
          <Link href="/checklists/novo" className="mt-4 inline-block text-sm text-ember hover:text-ember-hover">
            Criar primeiro checklist →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              score={lastScoreMap[t.id] ?? null}
              count={itemCountMap[t.id] ?? 0}
              unitName={t.unit_id ? (unitsMap[t.unit_id] ?? null) : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
