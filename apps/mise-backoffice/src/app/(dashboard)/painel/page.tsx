import { createServiceClient } from '@/lib/supabase/server'
import { DashboardClient } from '../_components/dashboard-client'

type SearchParams = Promise<{ unit?: string }>

export type KpiItem = {
  id: string
  nome: string
  unit_name: string
  employee_name: string
  data_manipulacao?: string
  validade?: string
  status?: string
  created_at?: string
  quantity?: number
  unit?: string
  scheduled_for?: string
  prod_status?: string
}

export type LabelGroup = {
  key: string
  nome: string
  unit_name: string
  status: string
  count: number
  items: KpiItem[]
}

function getTodayRange() {
  const spDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const [y, m, d] = spDate.split('-').map(Number)
  const start = `${spDate}T00:00:00-03:00`
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
  return { start, end: `${next}T00:00:00-03:00` }
}

function getSPDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const { unit } = await searchParams
  const supabase = createServiceClient()
  const { start: todayStart, end: todayEnd } = getTodayRange()

  let qEtiquetasHoje = supabase.schema('mise').from('labels')
    .select('id, nome, unit_id, employee_id, data_manipulacao, validade, status')
    .gte('data_manipulacao', todayStart).lt('data_manipulacao', todayEnd)
    .order('data_manipulacao', { ascending: false })

  let qLabelsAtivas = supabase.schema('mise').from('labels')
    .select('id, nome, unit_id, employee_id, validade, status')
    .eq('status', 'ativa').order('validade', { ascending: true })

  let qProducoesDia = supabase.schema('mise').from('production_orders')
    .select('id, unit_id, menu_item_id, quantity, unit, scheduled_for, assigned_to, status, created_at')
    .gte('created_at', todayStart).lt('created_at', todayEnd)
    .order('created_at', { ascending: false })

  let qDescartesDia = supabase.schema('mise').from('labels')
    .select('id, nome, unit_id, employee_id, data_manipulacao, validade, status, created_at')
    .eq('status', 'descartada')
    .gte('created_at', todayStart).lt('created_at', todayEnd)
    .order('created_at', { ascending: false })

  let qUltimasLabels = supabase.schema('mise').from('labels')
    .select('id, nome, unit_id, employee_id, data_manipulacao, validade, status')
    .order('data_manipulacao', { ascending: false }).limit(40)

  if (unit) {
    qEtiquetasHoje = qEtiquetasHoje.eq('unit_id', unit)
    qLabelsAtivas = qLabelsAtivas.eq('unit_id', unit)
    qProducoesDia = qProducoesDia.eq('unit_id', unit)
    qDescartesDia = qDescartesDia.eq('unit_id', unit)
    qUltimasLabels = qUltimasLabels.eq('unit_id', unit)
  }

  const [
    { data: etiquetasHoje },
    { data: labelsAtivas },
    { data: producoesDia },
    { data: descartesDia },
    { data: ultimasLabels },
    { data: units },
    { data: employees },
    { data: menuItems },
  ] = await Promise.all([
    qEtiquetasHoje,
    qLabelsAtivas,
    qProducoesDia,
    qDescartesDia,
    qUltimasLabels,
    supabase.from('units').select('id, name').eq('active', true).order('name'),
    supabase.from('employees').select('id, nome').eq('ativo', true),
    supabase.from('menu_items').select('id, nome'),
  ])

  const unitsMap = Object.fromEntries((units ?? []).map(u => [u.id, u.name]))
  const employeesMap = Object.fromEntries((employees ?? []).map(e => [e.id, e.nome]))
  const menuItemsMap = Object.fromEntries((menuItems ?? []).map(m => [m.id, m.nome]))

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const kpiCriticas: KpiItem[] = (labelsAtivas ?? [])
    .filter(l => new Date(l.validade) <= in24h)
    .map(l => ({
      id: l.id,
      nome: l.nome,
      unit_name: unitsMap[l.unit_id] ?? '—',
      employee_name: employeesMap[l.employee_id ?? ''] ?? '—',
      validade: l.validade,
      status: l.status,
    }))

  const kpiEtiquetasHoje: KpiItem[] = (etiquetasHoje ?? []).map(l => ({
    id: l.id,
    nome: l.nome,
    unit_name: unitsMap[l.unit_id] ?? '—',
    employee_name: employeesMap[l.employee_id ?? ''] ?? '—',
    data_manipulacao: l.data_manipulacao,
    validade: l.validade,
    status: l.status,
  }))

  const kpiProducoes: KpiItem[] = (producoesDia ?? []).map(p => ({
    id: p.id,
    nome: p.menu_item_id ? (menuItemsMap[p.menu_item_id] ?? 'Item sem cadastro') : 'Sem produto',
    unit_name: unitsMap[p.unit_id] ?? '—',
    employee_name: p.assigned_to ? (employeesMap[p.assigned_to] ?? '—') : '—',
    created_at: p.created_at,
    scheduled_for: p.scheduled_for ?? undefined,
    quantity: p.quantity,
    unit: p.unit,
    prod_status: p.status,
  }))

  const kpiDescartes: KpiItem[] = (descartesDia ?? []).map(l => ({
    id: l.id,
    nome: l.nome,
    unit_name: unitsMap[l.unit_id] ?? '—',
    employee_name: employeesMap[l.employee_id ?? ''] ?? '—',
    data_manipulacao: l.data_manipulacao,
    created_at: l.created_at,
    status: l.status,
  }))

  // Agrega etiquetas recentes por produto+unidade+dia(SP)+status
  const groupMap = new Map<string, {
    nome: string; unit_name: string; status: string; items: KpiItem[]; latestMs: number
  }>()

  for (const l of ultimasLabels ?? []) {
    const day = getSPDay(l.data_manipulacao)
    const key = `${l.nome}|${l.unit_id}|${day}|${l.status}`
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        nome: l.nome,
        unit_name: unitsMap[l.unit_id] ?? '—',
        status: l.status,
        items: [],
        latestMs: new Date(l.data_manipulacao).getTime(),
      })
    }
    const g = groupMap.get(key)!
    g.items.push({
      id: l.id,
      nome: l.nome,
      unit_name: unitsMap[l.unit_id] ?? '—',
      employee_name: employeesMap[l.employee_id ?? ''] ?? '—',
      data_manipulacao: l.data_manipulacao,
      validade: l.validade,
      status: l.status,
    })
    g.latestMs = Math.max(g.latestMs, new Date(l.data_manipulacao).getTime())
  }

  const labelGroups: LabelGroup[] = Array.from(groupMap.entries())
    .sort((a, b) => b[1].latestMs - a[1].latestMs)
    .slice(0, 10)
    .map(([key, g]) => ({
      key,
      nome: g.nome,
      unit_name: g.unit_name,
      status: g.status,
      count: g.items.length,
      items: g.items,
    }))

  return (
    <DashboardClient
      units={units ?? []}
      currentUnit={unit ?? ''}
      kpiEtiquetasHoje={kpiEtiquetasHoje}
      kpiCriticas={kpiCriticas}
      kpiProducoes={kpiProducoes}
      kpiDescartes={kpiDescartes}
      labelGroups={labelGroups}
    />
  )
}
