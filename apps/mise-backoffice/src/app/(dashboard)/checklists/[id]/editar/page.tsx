import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EditarClient } from './_components/editar-client'

export default async function EditarChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: template }, { data: items }] = await Promise.all([
    supabase.schema('mise').from('checklist_templates').select('id, nome').eq('id', id).single(),
    supabase.schema('mise').from('checklist_template_items').select('*').eq('template_id', id).order('ordem'),
  ])

  if (!template) notFound()

  return (
    <div className="p-6 max-w-2xl">
      <Link href="/checklists" className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink-muted mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Checklists
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Editar checklist</h1>
        <p className="text-sm text-ink-muted mt-1">{template.nome}</p>
      </div>

      <EditarClient templateId={id} initialItems={items ?? []} />
    </div>
  )
}
