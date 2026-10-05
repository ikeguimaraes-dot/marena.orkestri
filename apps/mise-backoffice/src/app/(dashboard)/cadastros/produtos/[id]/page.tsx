import { createServiceClient } from '@/lib/supabase/server'
import { ProdutoForm } from '../_components/produto-form'
import { notFound } from 'next/navigation'

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: produto }, { data: groups }, { data: suppliers }] = await Promise.all([
    supabase.from('ingredients').select('id, nome, codigo, group_id, categoria, categoria_anvisa, unidade_padrao, custo_padrao, fornecedor_id, perdas_padrao, observacoes, ativo').eq('id', id).single(),
    supabase.from('groups').select('id, name').order('name'),
    supabase.from('suppliers').select('id, nome').eq('ativo', true).order('nome'),
  ])

  if (!produto) notFound()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Editar Produto</h1>
        <p className="text-sm text-ink-muted">{produto.nome}</p>
      </div>
      <ProdutoForm groups={groups ?? []} suppliers={suppliers ?? []} initial={produto} />
    </div>
  )
}
