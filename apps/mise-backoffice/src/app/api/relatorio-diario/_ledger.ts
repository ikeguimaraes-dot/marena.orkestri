import { writeOpxEvent } from '@/lib/opx/ledger'

type TurnoEventType = 'turno.period.closed' | 'turno.closed'

interface TurnoEventPayload {
  type: TurnoEventType
  unitId: string
  entityId: string
  actorId: string
  occurredAt: string
  payload?: Record<string, unknown>
}

// Controlado por OPX_LEDGER_ENABLED=true — seam para Fase 0 do ledger.
// writeOpxEvent nunca lança; falhas retornam { ok: false } e são logadas.
export async function emitTurnoEvent(event: TurnoEventPayload): Promise<void> {
  if (process.env.OPX_LEDGER_ENABLED !== 'true') return

  const result = await writeOpxEvent({
    unitId: event.unitId,
    module: 'TURNO',
    type: event.type,
    entityId: event.entityId,
    actorId: event.actorId,
    occurredAt: event.occurredAt,
    payload: event.payload,
  })

  if (!result.ok) {
    console.error('[TURNO ledger] write failed', result.error, {
      type: event.type,
      unitId: event.unitId,
      occurredAt: event.occurredAt,
    })
  }
}
