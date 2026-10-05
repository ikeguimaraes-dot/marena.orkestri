import { createServiceClient } from '@/lib/supabase/server'
import { ValidadesClient } from './_components/validades-client'

export type LabelRow = {
  id: string
  unit_id: string
  employee_id: string | null
  nome: string
  tipo: string
  peso_kg: number | null
  metodo_conservacao: string | null
  validade: string
  data_manipulacao: string
  status: string
  unit_name: string
  employee_name: string | null
}

export type UnitOption = { id: string; name: string }

export default async function ValidadesPage() {
  const supabase = createServiceClient()

  const { data: labels } = await supabase
    .schema('mise')
    .from('labels')
    .select('id, unit_id, employee_id, nome, tipo, peso_kg, metodo_conservacao, validade, data_manipulacao, status')
    .eq('status', 'ativa')
    .order('validade', { ascending: true })

  const unitIds = Array.from(new Set((labels ?? []).map(l => l.unit_id)))
  const empIds = Array.from(new Set((labels ?? []).map(l => l.employee_id).filter(Boolean))) as string[]

  const [{ data: units }, { data: emps }] = await Promise.all([
    unitIds.length ? supabase.from('units').select('id, name').in('id', unitIds) : Promise.resolve({ data: [] }),
    empIds.length ? supabase.from('employees').select('id, nome').in('id', empIds) : Promise.resolve({ data: [] }),
  ])

  const { data: allUnits } = await supabase.from('units').select('id, name').eq('active', true)

  const unitsMap = Object.fromEntries((units ?? []).map(u => [u.id, u.name]))
  const empsMap = Object.fromEntries((emps ?? []).map(e => [e.id, e.nome]))

  const rows: LabelRow[] = (labels ?? []).map(l => ({
    ...l,
    unit_name: unitsMap[l.unit_id] ?? '—',
    employee_name: l.employee_id ? (empsMap[l.employee_id] ?? null) : null,
  }))

  return <ValidadesClient initialLabels={rows} units={allUnits ?? []} />
}
