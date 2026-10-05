import { createServiceClient } from '@/lib/supabase/server'
import { EmployeeToggle } from './_components/employee-toggle'

export default async function FuncionariosPage() {
  const supabase = createServiceClient()

  const { data: employees } = await supabase
    .from('employees')
    .select('id, nome, departamento, ativo, mise_ativo')
    .eq('ativo', true)
    .order('nome')

  const total = employees?.length ?? 0
  const ativos = employees?.filter(e => e.mise_ativo).length ?? 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Funcionários</h1>
        <p className="text-sm text-ink-muted">Gerencie o acesso ao MISE</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Total de funcionários', value: total, color: 'text-ink' },
          { label: 'Ativos no MISE', value: ativos, color: 'text-fresh' },
          { label: 'Sem acesso', value: total - ativos, color: 'text-ink-muted' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-edge bg-surface p-4">
            <p className="text-xs font-medium text-ink-muted">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-edge bg-surface">
        <div className="border-b border-edge px-5 py-4">
          <p className="text-sm font-semibold text-ink">Funcionários ativos</p>
        </div>
        <div className="divide-y divide-edge">
          {(employees ?? []).map(e => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-ink">{e.nome}</p>
                <p className="text-xs text-ink-subtle">{e.departamento ?? 'Sem departamento'}</p>
              </div>
              <EmployeeToggle id={e.id} miseAtivo={e.mise_ativo ?? false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
