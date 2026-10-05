import { createServiceClient } from '@/lib/supabase/server'
import { GrupoForm } from '../_components/grupo-form'

export default async function NovoGrupoPage() {
  const supabase = createServiceClient()
  const { data: groups } = await supabase.from('groups').select('id, name').order('name')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Novo Grupo</h1>
        <p className="text-sm text-ink-muted">Criar categoria de produtos</p>
      </div>
      <GrupoForm groups={groups ?? []} />
    </div>
  )
}
