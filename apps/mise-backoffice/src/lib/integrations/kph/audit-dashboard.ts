import type { SupabaseClient } from '@supabase/supabase-js'
import {
  KPH_AUDIT_TIMEZONE,
  type AuditBucket,
  type KphAuditDashboardResponse,
} from './contracts'

type Execution = {
  id: string
  template_id: string
  pontuacao_total: number | string | null
  pontuacao_obtida: number | string | null
  concluido_em: string
}
type ChecklistResponseRow = {
  execution_id: string
  item_id: string
  resposta: { valor?: unknown } | null
  nao_aplicavel: boolean
}
type Item = { id: string; template_id: string; titulo: string; tipo_resposta: string; peso: number | string | null }
type Template = { id: string; nome: string; departamento: string | null }

export class AuditDashboardDatabaseError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message)
  }
}

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KPH_AUDIT_TIMEZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
})

function localDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

function bucketKey(iso: string, bucket: AuditBucket): string {
  const day = localDate(iso)
  if (bucket === 'day') return day
  if (bucket === 'month') return `${day.slice(0, 7)}-01`
  const date = new Date(`${day}T12:00:00Z`)
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return date.toISOString().slice(0, 10)
}

function startOfSaoPauloDay(day: string): string {
  const target = Date.parse(`${day}T00:00:00Z`)
  let candidate = target + 3 * 60 * 60 * 1_000
  const partsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: KPH_AUDIT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = Object.fromEntries(partsFormatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]))
    const represented = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    )
    candidate += target - represented
  }
  return new Date(candidate).toISOString()
}

function dayAfter(day: string): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

function number(value: number | string | null): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundedRate(obtained: number, total: number): number {
  return total > 0 ? Math.round((obtained / total) * 10_000) / 100 : 0
}

function chunks<T>(values: T[], size = 200): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await promise
  if (error) throw new AuditDashboardDatabaseError(error.message, error.code)
  return data as T
}

async function batchedIn<T>(
  ids: string[],
  load: (ids: string[]) => Promise<T[]>,
): Promise<T[]> {
  const result: T[] = []
  for (const batch of chunks([...new Set(ids)])) result.push(...await load(batch))
  return result
}

export async function unitExists(supabase: SupabaseClient, unitId: string): Promise<boolean> {
  const result = await unwrap<{ id: string }[]>(supabase.from('units').select('id').eq('id', unitId).limit(1))
  return result.length > 0
}

export async function loadAuditDashboard(
  supabase: SupabaseClient,
  input: { unitId: string; from: string; to: string; bucket: AuditBucket; topLimit: number },
): Promise<KphAuditDashboardResponse> {
  const mise = supabase.schema('mise')
  const executions = await unwrap<Execution[]>(
    mise.from('checklist_executions')
      .select('id,template_id,pontuacao_total,pontuacao_obtida,concluido_em')
      .eq('unit_id', input.unitId)
      .eq('status', 'concluido')
      .gte('concluido_em', startOfSaoPauloDay(input.from))
      .lt('concluido_em', startOfSaoPauloDay(dayAfter(input.to)))
      .order('concluido_em', { ascending: true }),
  )

  const executionById = new Map(executions.map((row) => [row.id, row]))
  const responses = await batchedIn(executions.map((row) => row.id), async (ids) =>
    unwrap<ChecklistResponseRow[]>(mise.from('checklist_responses')
      .select('execution_id,item_id,resposta,nao_aplicavel').in('execution_id', ids)),
  )
  const items = await batchedIn(responses.map((row) => row.item_id), async (ids) =>
    unwrap<Item[]>(mise.from('checklist_template_items')
      .select('id,template_id,titulo,tipo_resposta,peso').in('id', ids)),
  )
  const itemById = new Map(items.map((row) => [row.id, row]))
  const negativeResponses = responses.filter((row) => {
    const item = itemById.get(row.item_id)
    return !row.nao_aplicavel && item?.tipo_resposta === 'sim_nao' && row.resposta?.valor === 'nao'
  })
  const templates = await batchedIn(
    negativeResponses.map((row) => itemById.get(row.item_id)?.template_id).filter((id): id is string => Boolean(id)),
    async (ids) => unwrap<Template[]>(mise.from('checklist_templates')
      .select('id,nome,departamento').in('id', ids)),
  )
  const templateById = new Map(templates.map((row) => [row.id, row]))

  const scoreable = executions.filter((row) => number(row.pontuacao_total) > 0)
  const total = scoreable.reduce((sum, row) => sum + number(row.pontuacao_total), 0)
  const obtained = scoreable.reduce((sum, row) => sum + number(row.pontuacao_obtida), 0)
  const series = new Map<string, { total: number; obtained: number; completed: number; negatives: number }>()
  for (const execution of executions) {
    const key = bucketKey(execution.concluido_em, input.bucket)
    const point = series.get(key) ?? { total: 0, obtained: 0, completed: 0, negatives: 0 }
    point.completed++
    if (number(execution.pontuacao_total) > 0) {
      point.total += number(execution.pontuacao_total)
      point.obtained += number(execution.pontuacao_obtida)
    }
    series.set(key, point)
  }

  type Occurrence = { item: Item; count: number; last: string }
  const occurrences = new Map<string, Occurrence>()
  for (const response of negativeResponses) {
    const execution = executionById.get(response.execution_id)
    const item = itemById.get(response.item_id)
    if (!execution || !item) continue
    const key = bucketKey(execution.concluido_em, input.bucket)
    const point = series.get(key)
    if (point) point.negatives++
    const current = occurrences.get(item.id)
    occurrences.set(item.id, {
      item,
      count: (current?.count ?? 0) + 1,
      last: !current || execution.concluido_em > current.last ? execution.concluido_em : current.last,
    })
  }

  const topNonConformities = [...occurrences.values()]
    .sort((a, b) => b.count - a.count || number(b.item.peso) - number(a.item.peso) || b.last.localeCompare(a.last))
    .slice(0, input.topLimit)
    .map(({ item, count, last }) => {
      const template = templateById.get(item.template_id)
      return {
        itemId: item.id,
        itemTitle: item.titulo,
        templateId: item.template_id,
        templateName: template?.nome ?? '',
        department: template?.departamento ?? null,
        weight: number(item.peso),
        occurrences: count,
        lastOccurredAt: last,
      }
    })

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    timezone: KPH_AUDIT_TIMEZONE,
    unit: { id: input.unitId },
    period: { from: input.from, to: input.to, bucket: input.bucket },
    summary: {
      conformityRate: roundedRate(obtained, total),
      completedChecklists: executions.length,
      nonConformities: negativeResponses.length,
    },
    series: [...series.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, point]) => ({
      period,
      conformityRate: roundedRate(point.obtained, point.total),
      completedChecklists: point.completed,
      nonConformities: point.negatives,
    })),
    topNonConformities,
  }
}
