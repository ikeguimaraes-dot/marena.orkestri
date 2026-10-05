export const KPH_AUDIT_TIMEZONE = 'America/Sao_Paulo' as const

export type AuditBucket = 'day' | 'week' | 'month'

export type KphAuditDashboardResponse = {
  version: '1.0'
  generatedAt: string
  timezone: typeof KPH_AUDIT_TIMEZONE
  unit: { id: string }
  period: { from: string; to: string; bucket: AuditBucket }
  summary: {
    conformityRate: number
    completedChecklists: number
    nonConformities: number
  }
  series: Array<{
    period: string
    conformityRate: number
    completedChecklists: number
    nonConformities: number
  }>
  topNonConformities: Array<{
    itemId: string
    itemTitle: string
    templateId: string
    templateName: string
    department: string | null
    weight: number
    occurrences: number
    lastOccurredAt: string
  }>
}

export type IntegrationErrorCode =
  | 'INVALID_QUERY'
  | 'INVALID_INTEGRATION_TOKEN'
  | 'UNIT_NOT_ALLOWED'
  | 'UNIT_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'DATABASE_UNAVAILABLE'
  | 'QUERY_TIMEOUT'

export type IntegrationErrorResponse = {
  error: { code: IntegrationErrorCode; message: string; requestId: string }
}
