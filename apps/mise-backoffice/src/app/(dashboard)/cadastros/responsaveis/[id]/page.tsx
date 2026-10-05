import { createServiceClient } from '@/lib/supabase/server'
import { ResponsavelForm } from '../_components/responsavel-form'
import { notFound } from 'next/navigation'

export default async function EditarResponsavelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: responsavel }, { data: units }] = await Promise.all([
    supabase.schema('mise').from('responsaveis').select('id, nome, ativo, responsavel_unidades(unit_id)').eq('id', id).single(),
    supabase.from('units').select('id, name').eq('active', true).order('name'),
  ])

  if (!responsavel) notFound()

  const initial = {
    id: responsavel.id,
    nome: responsavel.nome,
    ativo: responsavel.ativo,
    unit_ids: (responsavel.responsavel_unidades ?? []).map((ru: { unit_id: string }) => ru.unit_id),
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Editar Responsável</h1>
        <p className="text-sm text-ink-muted">{responsavel.nome}</p>
      </div>
      <ResponsavelForm units={units ?? []} initial={initial} />
    </div>
  )
}
