import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil } from 'lucide-react'

const CATEGORIA_LABEL: Record<string, string> = {
  documentacao: 'Documentação',
  operacional: 'Operacional',
  estrutural: 'Estrutural',
}

export default async function CrivoTemplatesPage() {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const supabase = createServiceClient()

  const [{ data: templates }, { data: units }] = await Promise.all([
    supabase.schema('mise').from('checklist_templates')
      .select('id, nome, categoria, unit_id')
      .eq('modulo', 'CRIVO')
      .eq('ativo', true)
      .order('categoria')
      .order('nome'),
    supabase.from('units').select('id, name').eq('active', true),
  ])

  const unitsMap = Object.fromEntries((units ?? []).map(u => [u.id, u.name]))

  const grouped: Record<string, typeof templates> = {}
  for (const t of (templates ?? [])) {
    const cat = t.categoria ?? 'sem_categoria'
    grouped[cat] = grouped[cat] ?? []
    grouped[cat]!.push(t)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/crivo" className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink-muted mb-3 w-fit">
            <ArrowLeft className="h-3.5 w-3.5" /> CRIVO
          </Link>
          <h1 className="text-xl font-bold text-ink">Templates CRIVO</h1>
          <p className="text-sm text-ink-muted">Checklists de auditoria por categoria</p>
        </div>
        <Link
          href="/checklists/novo?modulo=CRIVO"
          className="flex items-center gap-1.5 rounded-lg bg-ember px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Novo
        </Link>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-edge bg-surface p-10 text-center">
          <p className="text-sm text-ink-muted">Nenhum template CRIVO cadastrado.</p>
          <Link href="/checklists/novo?modulo=CRIVO" className="mt-3 inline-block text-sm text-ember hover:opacity-80">
            Criar primeiro template →
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {['documentacao', 'operacional', 'estrutural'].map(cat => {
            const items = grouped[cat] ?? []
            if (!items.length) return null
            return (
              <div key={cat}>
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint mb-2">
                  {CATEGORIA_LABEL[cat] ?? cat}
                </p>
                <div className="rounded-xl border border-edge bg-surface divide-y divide-edge/60">
                  {items.map(t => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{t.nome}</p>
                        {t.unit_id && (
                          <p className="text-xs text-ink-muted">{unitsMap[t.unit_id] ?? t.unit_id}</p>
                        )}
                      </div>
                      <Link
                        href={`/checklists/${t.id}/editar`}
                        className="flex h-7 w-7 items-center justify-center rounded text-ink-faint hover:bg-surface-raised hover:text-ink transition-colors shrink-0"
                        aria-label="Editar template"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
