import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authenticateKphIntegration } from '@/lib/integrations/kph/auth'
import { AuditDashboardDatabaseError, loadAuditDashboard, unitExists } from '@/lib/integrations/kph/audit-dashboard'
import type { AuditBucket, IntegrationErrorCode, IntegrationErrorResponse } from '@/lib/integrations/kph/contracts'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const BUCKETS = new Set<AuditBucket>(['day', 'week', 'month'])

function error(status: number, code: IntegrationErrorCode, message: string, requestId: string) {
  return NextResponse.json<IntegrationErrorResponse>({ error: { code, message, requestId } }, {
    status,
    headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' },
  })
}

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function daysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('QUERY_TIMEOUT')), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function GET(request: Request) {
  const requestId = randomUUID()
  const startedAt = Date.now()
  const auth = authenticateKphIntegration(request.headers.get('authorization'))
  if (!auth.ok) {
    if (auth.reason === 'misconfigured') {
      console.error('KPH integration misconfigured', { requestId, route: 'audit-dashboard' })
      return error(500, 'INTERNAL_ERROR', 'Integração indisponível', requestId)
    }
    return error(401, 'INVALID_INTEGRATION_TOKEN', 'Token de integração inválido', requestId)
  }

  const params = new URL(request.url).searchParams
  const unitId = params.get('unit_id')?.toLowerCase() ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const bucketValue = params.get('bucket') ?? 'day'
  const topLimitValue = params.get('top_limit') ?? '10'
  const topLimit = Number(topLimitValue)

  if (!UUID.test(unitId) || !validDate(from) || !validDate(to) || !BUCKETS.has(bucketValue as AuditBucket)
    || !/^\d+$/.test(topLimitValue) || topLimit < 1 || topLimit > 50
    || from > to || daysBetween(from, to) > 366) {
    return error(400, 'INVALID_QUERY', 'Parâmetros de consulta inválidos', requestId)
  }
  if (!auth.allowedUnits.has(unitId)) {
    return error(403, 'UNIT_NOT_ALLOWED', 'Unidade não autorizada', requestId)
  }

  const timeout = Math.min(30_000, Math.max(1_000, Number(process.env.KPH_INTEGRATION_TIMEOUT_MS) || 5_000))
  const supabase = createServiceClient()
  try {
    const exists = await withTimeout(unitExists(supabase, unitId), timeout)
    if (!exists) return error(404, 'UNIT_NOT_FOUND', 'Unidade não encontrada', requestId)
    const payload = await withTimeout(loadAuditDashboard(supabase, {
      unitId, from, to, bucket: bucketValue as AuditBucket, topLimit,
    }), timeout)
    console.info('KPH audit dashboard', {
      requestId, route: 'audit-dashboard', unitId, from, to,
      status: 200, durationMs: Date.now() - startedAt,
    })
    return NextResponse.json(payload, {
      headers: { 'X-Request-Id': requestId, 'Cache-Control': 'private, max-age=30' },
    })
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.message === 'QUERY_TIMEOUT'
    const databaseError = cause instanceof AuditDashboardDatabaseError
    console.error('KPH audit dashboard failed', {
      requestId, route: 'audit-dashboard', unitId, from, to,
      status: timedOut ? 504 : 503, durationMs: Date.now() - startedAt,
      errorCode: databaseError ? cause.code : undefined,
    })
    if (timedOut) return error(504, 'QUERY_TIMEOUT', 'Tempo limite da consulta excedido', requestId)
    if (databaseError) return error(503, 'DATABASE_UNAVAILABLE', 'Banco de dados indisponível', requestId)
    return error(500, 'INTERNAL_ERROR', 'Erro interno', requestId)
  }
}
