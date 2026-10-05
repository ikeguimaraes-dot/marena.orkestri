import { createServiceClient } from '@/lib/supabase/server'
import { ProdutoForm } from '../_components/produto-form'

export default async function NovoProdutoPage() {
  const supabase = createServiceClient()
  const [{ data: groups }, { data: suppliers }] = await Promise.all([
    supabase.from('groups').select('id, name').order('name'),
    supabase.from('suppliers').select('id, nome').eq('ativo', true).order('nome'),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Novo Produto</h1>
        <p className="text-sm text-ink-muted">Cadastrar insumo ou ingrediente</p>
      </div>
      <ProdutoForm groups={groups ?? []} suppliers={suppliers ?? []} />
    </div>
  )
}
