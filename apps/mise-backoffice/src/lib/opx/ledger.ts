// Prerequisito: schema 'opx' precisa estar em Supabase → Settings → API → Exposed schemas.
// Enquanto não estiver, writeOpxEvent retorna { ok: false } silenciosamente.
import { createServiceClient } from '@/lib/supabase/server'

export type OpxModule = 'TURNO' | 'RITMO' | 'CRIVO' | 'SALDO'

export interface OpxEventInput {
  unitId: string
  module: OpxModule
  type: string
  entityId: string
  actorId: string   // sempre employees.id — nunca auth.users.id
  occurredAt: string
  payload?: Record<string, unknown>
}

export interface OpxEvidenceInput {
  kind: string
  value: unknown
}

export type WriteResult = { ok: true; eventId: string } | { ok: false; error: string }

export async function writeOpxEvent(
  input: OpxEventInput,
  evidences?: OpxEvidenceInput[]
): Promise<WriteResult> {
  try {
    const supabase = createServiceClient()

    const { data: event, error: evErr } = await supabase
      .schema('opx')
      .from('event')
      .insert({
        unit_id: input.unitId,
        module: input.module,
        type: input.type,
        entity_id: input.entityId,
        actor_id: input.actorId,
        occurred_at: input.occurredAt,
        payload: input.payload ?? {},
      })
      .select('id')
      .single()

    if (evErr || !event) {
      return { ok: false, error: evErr?.message ?? 'insert failed' }
    }

    if (evidences && evidences.length > 0) {
      const { error: evdErr } = await supabase
        .schema('opx')
        .from('evidence')
        .insert(evidences.map(e => ({ event_id: event.id, kind: e.kind, value: e.value })))

      if (evdErr) {
        // Evento já gravado (append-only) — falha de evidência é não-fatal
        console.error('[OPX] evidence insert failed', evdErr.message)
      }
    }

    return { ok: true, eventId: event.id }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
