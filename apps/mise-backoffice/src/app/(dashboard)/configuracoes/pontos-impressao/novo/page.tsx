import { createServiceClient } from '@/lib/supabase/server'
import { PrintPointForm } from '../_components/print-point-form'

export default async function NovoPontoPage() {
  const supabase = createServiceClient()
  const { data: units } = await supabase.from('units').select('id, name').eq('active', true).order('name')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Novo Ponto de Impressão</h1>
        <p className="text-sm text-ink-muted">Cadastrar impressora</p>
      </div>
      <PrintPointForm units={units ?? []} />
    </div>
  )
}
