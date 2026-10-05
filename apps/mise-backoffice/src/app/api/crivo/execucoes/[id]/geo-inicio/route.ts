import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const lat = body?.lat
  const lng = body?.lng

  if (lat == null || lng == null) {
    return NextResponse.json({ error: 'lat e lng obrigatórios.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Only set if not already recorded
  const { data: existing } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .select('geo_inicio_lat')
    .eq('id', id)
    .single()

  if (existing?.geo_inicio_lat != null) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { error } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .update({ geo_inicio_lat: lat, geo_inicio_lng: lng })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
