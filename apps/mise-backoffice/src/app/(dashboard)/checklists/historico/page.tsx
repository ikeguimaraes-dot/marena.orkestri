import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, History } from 'lucide-react'

function scoreColor(pct: number) {
  if (pct >= 80) return 'text-fresh-bright bg-fresh/10'
  if (pct >= 60) return 'text-warn-bright bg-warn/10'
  return 'text-alert-bright bg-alert/10'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function ChecklistHistoricoPage() {
  const supabase = createServiceClient()

  const [
    { data: execucoes },
    { data: templates },
    { data: units },
  ] = await Promise.all([
    supabase.schema('mise').from('checklist_executions').select('*').eq('status', 'concluido').order('concluido_em', { ascending: false }).limit(200),
    supabase.schema('mise').from('checklist_templates').select('id, nome'),
    supabase.from('units').select('id, name'),
  ])

  const templatesMap = Object.fromEntries((templates ?? []).map(t => [t.id, t.nome]))
  const unitsMap = Object.fromEntries((units ?? []).map(u => [u.id, u.name]))

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <Link href="/checklists" className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink-muted mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Checklists
        </Link>
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
          <History className="h-5 w-5 text-ink-muted" />
          Histórico de Execuções
        </h1>
        <p className="mt-1 text-sm text-ink-subtle">Todas as execuções concluídas</p>
      </div>

      {!execucoes || execucoes.length === 0 ? (
        <div className="rounded-lg border border-edge bg-surface p-12 text-center">
          <History className="mx-auto h-10 w-10 text-ink-faint mb-3" />
          <p className="text-ink-muted">Nenhuma execução concluída ainda.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-edge overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-edge bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-subtle uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-subtle uppercase tracking-wider">Checklist</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-subtle uppercase tracking-wider">Turno</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-subtle uppercase tracking-wider">Unidade</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-ink-subtle uppercase tracking-wider">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge bg-base">
              {execucoes.map(ex => (
                <tr key={ex.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                    {fmtDate(ex.concluido_em ?? ex.iniciado_em)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/checklists/historico/${ex.id}`} className="font-medium text-ink hover:text-ember transition-colors">
                      {templatesMap[ex.template_id] ?? 'Template removido'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{ex.turno ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{unitsMap[ex.unit_id] ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${scoreColor(ex.percentual)}`}>
                      {ex.percentual.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
