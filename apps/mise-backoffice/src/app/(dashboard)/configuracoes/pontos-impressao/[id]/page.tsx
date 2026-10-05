import { createServiceClient } from '@/lib/supabase/server'
import { PrintPointForm } from '../_components/print-point-form'
import { notFound } from 'next/navigation'

export default async function EditarPontoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: point }, { data: units }] = await Promise.all([
    supabase.schema('mise').from('print_points').select('id, unit_id, name, icone, rede, ip_address, ativo').eq('id', id).single(),
    supabase.from('units').select('id, name').eq('active', true).order('name'),
  ])

  if (!point) notFound()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Editar Ponto de Impressão</h1>
        <p className="text-sm text-ink-muted">{point.name}</p>
      </div>
      <PrintPointForm units={units ?? []} initial={point} />
    </div>
  )
}
