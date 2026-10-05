import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_STATUS = ['ativa', 'consumida', 'descartada', 'vencida']

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  if (body.status && !VALID_STATUS.includes(body.status)) {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .schema('mise')
    .from('labels')
    .update(body)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
