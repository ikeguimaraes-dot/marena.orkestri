import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'

type SearchParams = Promise<{ q?: string; group?: string; page?: string }>

export default async function ProdutosPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, group, page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = createServiceClient()

  const { data: groups } = await supabase.from('groups').select('id, name').order('name')

  let query = supabase.from('ingredients')
    .select('id, nome, codigo, group_id, categoria, categoria_anvisa, unidade_padrao, ativo', { count: 'exact' })
    .eq('ativo', true)
    .order('nome')
    .range(from, to)

  if (q) query = query.ilike('nome', `%${q}%`)
  if (group) query = query.eq('group_id', group)

  const { data: produtos, count } = await query

  const groupsMap = Object.fromEntries((groups ?? []).map(g => [g.id, g.name]))
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Produtos</h1>
          <p className="text-sm text-ink-muted">Insumos e ingredientes</p>
        </div>
        <Link href="/cadastros/produtos/novo"
          className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink hover:bg-ember-hover transition-colors">
          <Plus className="h-4 w-4" />
          Novo produto
        </Link>
      </div>

      <form method="GET" className="flex flex-wrap gap-3">
        <input name="q" defaultValue={q ?? ''} placeholder="Buscar produto..."
          className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-1.5 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
        <select name="group" defaultValue={group ?? ''}
          className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-1.5 text-sm text-ink focus:outline-none">
          <option value="">Todos os grupos</option>
          {(groups ?? []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button type="submit"
          className="rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-ember-ink hover:bg-ember-hover transition-colors">
          Filtrar
        </button>
        {(q || group) && (
          <Link href="/cadastros/produtos" className="rounded-lg border border-edge-strong px-3 py-1.5 text-sm text-ink-muted hover:text-ink transition-colors">
            Limpar
          </Link>
        )}
      </form>

      <div className="rounded-xl border border-edge bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge">
                {['Nome', 'Código', 'Grupo', 'Categoria', 'Cat. ANVISA', 'Unidade', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-ink-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {(produtos ?? []).map(p => (
                <tr key={p.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-ink">{p.nome}</td>
                  <td className="px-5 py-3 text-ink-muted">{p.codigo ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-muted">{groupsMap[p.group_id ?? ''] ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-muted">{p.categoria}</td>
                  <td className="px-5 py-3 text-ink-muted">{p.categoria_anvisa ?? <span className="text-warn-bright">—</span>}</td>
                  <td className="px-5 py-3 text-ink-muted">{p.unidade_padrao ?? '—'}</td>
                  <td className="px-5 py-3">
                    <Link href={`/cadastros/produtos/${p.id}`} className="text-xs text-ink-subtle hover:text-ink transition-colors">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {(produtos ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-ink-subtle">Nenhum produto encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-edge px-5 py-3">
            <p className="text-xs text-ink-subtle">{count} produtos · página {page} de {totalPages}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), ...(group ? { group } : {}), page: String(page - 1) })}`}
                  className="rounded border border-edge-strong px-3 py-1 text-xs text-ink-muted hover:text-ink transition-colors">
                  Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), ...(group ? { group } : {}), page: String(page + 1) })}`}
                  className="rounded border border-edge-strong px-3 py-1 text-xs text-ink-muted hover:text-ink transition-colors">
                  Próxima
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
