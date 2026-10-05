import { createServiceClient } from '@/lib/supabase/server'
import { GrupoForm } from '../_components/grupo-form'
import { notFound } from 'next/navigation'

export default async function EditarGrupoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: group }, { data: groups }] = await Promise.all([
    supabase.from('groups').select('id, name, icone, parent_id').eq('id', id).single(),
    supabase.from('groups').select('id, name').order('name'),
  ])

  if (!group) notFound()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Editar Grupo</h1>
        <p className="text-sm text-ink-muted">{group.name}</p>
      </div>
      <GrupoForm groups={groups ?? []} initial={group} />
    </div>
  )
}
