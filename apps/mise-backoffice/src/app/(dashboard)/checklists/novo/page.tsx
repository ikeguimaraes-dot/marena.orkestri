import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ChecklistForm } from './_components/checklist-form'

export default async function NovoChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ modulo?: string }>
}) {
  const supabase = createServiceClient()
  const { data: units } = await supabase.from('units').select('id, name').eq('active', true).order('name')
  const { modulo } = await searchParams
  const isCrivo = modulo === 'CRIVO'

  return (
    <div className="p-6 max-w-5xl">
      <Link
        href={isCrivo ? '/crivo/templates' : '/checklists'}
        className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink-muted mb-6 w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {isCrivo ? 'Templates CRIVO' : 'Checklists'}
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Novo {isCrivo ? 'Template CRIVO' : 'Checklist'}</h1>
        <p className="text-sm text-ink-muted mt-1">
          {isCrivo ? 'Crie um template de auditoria' : 'Crie um checklist operacional para sua equipe'}
        </p>
      </div>

      <ChecklistForm units={units ?? []} modulo={modulo ?? 'RITMO'} />
    </div>
  )
}
