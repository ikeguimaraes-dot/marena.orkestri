import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const data_inicio = searchParams.get('data_inicio')
  const data_fim = searchParams.get('data_fim')
  const unit_id = searchParams.get('unit_id')

  if (!data_inicio || !data_fim) {
    return NextResponse.json({ error: 'data_inicio e data_fim são obrigatórios.' }, { status: 400 })
  }

  const gteUTC = `${data_inicio}T03:00:00Z`
  const ltDate = new Date(`${data_fim}T03:00:00Z`)
  ltDate.setDate(ltDate.getDate() + 1)
  const ltUTC = ltDate.toISOString()

  const supabase = createServiceClient()

  let query = supabase
    .schema('mise')
    .from('labels')
    .select('id, nome, unit_id, employee_id, data_manipulacao, validade, status, metodo_conservacao, setor, peso_kg')
    .gte('data_manipulacao', gteUTC)
    .lt('data_manipulacao', ltUTC)
    .in('status', ['ativa', 'consumida', 'descartada'])
    .order('data_manipulacao', { ascending: false })

  if (unit_id) query = query.eq('unit_id', unit_id)

  const { data: labels } = await query

  const empIds = Array.from(new Set((labels ?? []).map(l => l.employee_id).filter(Boolean))) as string[]
  const { data: emps } = empIds.length
    ? await supabase.from('employees').select('id, nome').in('id', empIds)
    : { data: [] }
  const empsMap = Object.fromEntries((emps ?? []).map(e => [e.id, e.nome]))

  let unit_name = 'Todas as unidades'
  if (unit_id) {
    const { data: unit } = await supabase.from('units').select('name').eq('id', unit_id).single()
    if (unit) unit_name = unit.name
  }

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

  return NextResponse.json({ groups, total_labels, total_peso_kg, unit_name, data_inicio, data_fim })
}
