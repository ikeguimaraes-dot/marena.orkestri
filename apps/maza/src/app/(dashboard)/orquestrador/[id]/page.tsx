import { getRunDetails, submitRunDecision } from '@/lib/orquestrador/actions'
import type { HosApproval } from '@/lib/orquestrador/actions'
import { redirect } from 'next/navigation'

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params

  async function approve(formData: FormData) {
    'use server'
    const feedback = formData.get('feedback') as string
    const id = formData.get('run_id') as string
    const result = await submitRunDecision(id, 'approve', feedback)
    if (!result.ok) throw new Error(result.error)
    redirect('/orquestrador')
  }

  async function reject(formData: FormData) {
    'use server'
    const feedback = formData.get('feedback') as string
    const id = formData.get('run_id') as string
    const result = await submitRunDecision(id, 'reject', feedback)
    if (!result.ok) throw new Error(result.error)
    redirect('/orquestrador')
  }

  const run = await getRunDetails(runId)
  if (!run) redirect('/orquestrador')

  // Guards: logs pode vir como null do DB ou ter shape diferente (mockCreateRun usa time/message)
  const rawLogs = Array.isArray(run.logs) ? (run.logs as Array<Record<string, unknown>>) : []
  const logs = rawLogs.map((log) => ({
    ts: String(log.ts ?? log.time ?? ''),
    msg: String(log.msg ?? log.message ?? ''),
  }))

  const approvals: HosApproval[] = Array.isArray(run.hos_approvals) ? run.hos_approvals : []

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{run.job?.name ?? '—'}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {run.created_at ? new Date(run.created_at).toLocaleString('pt-BR') : '—'} · via {(run as any).triggered_by ?? '—'} · status: <strong>{run.status}</strong>
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-2 text-gray-600">Payload</h2>
        <pre className="text-xs text-gray-700 overflow-auto">
          {run.payload != null ? JSON.stringify(run.payload, null, 2) : '—'}
        </pre>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-2 text-gray-600">Logs do Agente</h2>
        <div className="space-y-1">
          {logs.length === 0 ? (
            <p className="text-xs text-gray-400">Sem logs registrados.</p>
          ) : (
            logs.map((log, i) => (
              <p key={i} className="text-xs font-mono text-gray-700">
                {log.ts && <span className="text-gray-400">[{log.ts}]</span>} {log.msg}
              </p>
            ))
          )}
        </div>
      </div>

      {run.status === 'awaiting_approval' && (
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Sua decisão</h2>
          <div className="flex gap-3">
            <form action={approve}>
              <input type="hidden" name="run_id" value={runId} />
              <input type="hidden" name="feedback" value="" />
              <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                ✅ Aprovar
              </button>
            </form>
            <form action={reject}>
              <input type="hidden" name="run_id" value={runId} />
              <input type="hidden" name="feedback" value="" />
              <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
                ❌ Rejeitar
              </button>
            </form>
          </div>
        </div>
      )}

      {approvals.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-2">Decisão registrada</h2>
          {approvals.map((a, i) => (
            <p key={i} className="text-sm">
              <strong>{a.decision === 'approve' ? '✅ Aprovado' : '❌ Rejeitado'}</strong>
              {a.feedback && ` — "${a.feedback}"`}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
