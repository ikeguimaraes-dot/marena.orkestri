import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function ResponsaveisPage() {
  const supabase = createServiceClient()

  const [{ data: responsaveis }, { data: units }] = await Promise.all([
    supabase
      .schema('mise')
      .from('responsaveis')
      .select('id, nome, ativo, responsavel_unidades(unit_id)')
      .order('nome'),
    supabase.from('units').select('id, name').eq('active', true).order('name'),
  ])

  const unitsMap = Object.fromEntries((units ?? []).map(u => [u.id, u.name]))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Responsáveis</h1>
          <p className="text-sm text-ink-muted">Responsáveis por etiqueta — independente do cadastro de funcionários (RH)</p>
        </div>
        <Link href="/cadastros/responsaveis/novo"
          className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink hover:bg-ember-hover transition-colors">
          <Plus className="h-4 w-4" />
          Novo responsável
        </Link>
      </div>

      <div className="rounded-xl border border-edge bg-surface">
        <div className="divide-y divide-edge">
          {(responsaveis ?? []).length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-subtle">Nenhum responsável cadastrado.</p>
          )}
          {(responsaveis ?? []).map(r => {
            const unitNames = (r.responsavel_unidades ?? [])
              .map((ru: { unit_id: string }) => unitsMap[ru.unit_id])
              .filter(Boolean)
            return (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-raised/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-ink">{r.nome}</p>
                  <p className="text-xs text-ink-subtle">
                    {unitNames.length > 0 ? unitNames.join(' · ') : 'Sem unidade vinculada'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${r.ativo ? 'text-fresh-bright' : 'text-ink-subtle'}`}>
                    {r.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                  <Link href={`/cadastros/responsaveis/${r.id}`}
                    className="text-xs text-ink-subtle hover:text-ink transition-colors">
                    Editar
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
