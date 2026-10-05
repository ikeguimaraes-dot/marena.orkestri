import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'

type SearchParams = Promise<{ unit?: string }>

export default async function PontosImpressaoPage({ searchParams }: { searchParams: SearchParams }) {
  const { unit } = await searchParams
  const supabase = createServiceClient()

  const { data: units } = await supabase.from('units').select('id, name').eq('active', true).order('name')

  let query = supabase.schema('mise').from('print_points')
    .select('id, unit_id, name, icone, rede, ip_address, ativo')
    .order('name')

  if (unit) query = query.eq('unit_id', unit)

  const { data: points } = await query

  const unitsMap = Object.fromEntries((units ?? []).map(u => [u.id, u.name]))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Pontos de Impressão</h1>
          <p className="text-sm text-ink-muted">Impressoras por unidade</p>
        </div>
        <Link href="/configuracoes/pontos-impressao/novo"
          className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink hover:bg-ember-hover transition-colors">
          <Plus className="h-4 w-4" />
          Novo ponto
        </Link>
      </div>

      <form method="GET" className="flex gap-3">
        <select name="unit" defaultValue={unit ?? ''}
          className="rounded-lg border border-edge-strong bg-surface-raised px-3 py-1.5 text-sm text-ink focus:outline-none">
          <option value="">Todas as unidades</option>
          {(units ?? []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button type="submit"
          className="rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-ember-ink hover:bg-ember-hover transition-colors">
          Filtrar
        </button>
      </form>

      <div className="rounded-xl border border-edge bg-surface">
        <div className="divide-y divide-edge">
          {(points ?? []).length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-subtle">Nenhum ponto cadastrado.</p>
          )}
          {(points ?? []).map(p => (
            <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-raised/50 transition-colors">
              <div className="flex items-center gap-3">
                {p.icone && <span className="text-xl">{p.icone}</span>}
                <div>
                  <p className="text-sm font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-ink-subtle">
                    {unitsMap[p.unit_id] ?? '—'}{p.ip_address ? ` · ${p.ip_address}` : ''}{p.rede ? ` · ${p.rede}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium ${p.ativo ? 'text-fresh-bright' : 'text-ink-subtle'}`}>
                  {p.ativo ? 'Online' : 'Offline'}
                </span>
                <Link href={`/configuracoes/pontos-impressao/${p.id}`}
                  className="text-xs text-ink-subtle hover:text-ink transition-colors">
                  Editar
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
