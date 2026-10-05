import { createServiceClient } from '@/lib/supabase/server'
import { ResponsavelForm } from '../_components/responsavel-form'

export default async function NovoResponsavelPage() {
  const supabase = createServiceClient()
  const { data: units } = await supabase.from('units').select('id, name').eq('active', true).order('name')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Novo Responsável</h1>
        <p className="text-sm text-ink-muted">Cadastrar responsável por etiqueta</p>
      </div>
      <ResponsavelForm units={units ?? []} />
    </div>
  )
}
