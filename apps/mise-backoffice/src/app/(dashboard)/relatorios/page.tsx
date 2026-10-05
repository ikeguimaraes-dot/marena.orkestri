import { createServiceClient } from '@/lib/supabase/server'
import { RelatorioClient } from './_components/relatorio-client'

export default async function RelatoriosPage() {
  const supabase = createServiceClient()

  const { data: units } = await supabase.from('units').select('id, name').eq('active', true)

  const spDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const dataInicio = spDate
  const dataFim = spDate

  const gteUTC = `${dataInicio}T03:00:00Z`
  const ltUTC = `${dataFim}T03:00:00Z`
  const ltDate = new Date(ltUTC)
  ltDate.setDate(ltDate.getDate() + 1)
  const ltUTCNext = ltDate.toISOString()

  const { data: labels } = await supabase
    .schema('mise')
    .from('labels')
    .select('id, nome, unit_id, employee_id, data_manipulacao, validade, status, metodo_conservacao, setor, peso_kg')
    .gte('data_manipulacao', gteUTC)
    .lt('data_manipulacao', ltUTCNext)
    .in('status', ['ativa', 'consumida', 'descartada'])
    .order('data_manipulacao', { ascending: false })

  const empIds = [...new Set((labels ?? []).map(l => l.employee_id).filter(Boolean))] as string[]
  const { data: emps } = empIds.length
    ? await supabase.from('employees').select('id, nome').in('id', empIds)
    : { data: [] }

  const empsMap = Object.fromEntries((emps ?? []).map(e => [e.id, e.nome]))

  type LabelWithName = NonNullable<typeof labels>[number] & { employee_name: string | null }
  type Group = { nome: string; total_count: number; total_peso_kg: number; labels: LabelWithName[] }
  const groupsMap = new Map<string, Group>()
  for (const l of labels ?? []) {
    if (!groupsMap.has(l.nome)) groupsMap.set(l.nome, { nome: l.nome, total_count: 0, total_peso_kg: 0, labels: [] })
    const g = groupsMap.get(l.nome)!
    g.total_count++
    g.total_peso_kg += l.peso_kg ?? 0
    g.labels.push({ ...l, employee_name: empsMap[l.employee_id ?? ''] ?? null })
  }

  const groups = Array.from(groupsMap.values())
  const total_labels = labels?.length ?? 0
  const total_peso_kg = groups.reduce((s, g) => s + g.total_peso_kg, 0)
  const unitName = 'Todas as unidades'

  return (
    <RelatorioClient
      initialGroups={groups}
      initialTotalLabels={total_labels}
      initialTotalPeso={total_peso_kg}
      initialDataInicio={dataInicio}
      initialDataFim={dataFim}
      initialUnitName={unitName}
      units={units ?? []}
    />
  )
}
