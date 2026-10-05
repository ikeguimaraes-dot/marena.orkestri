import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  const { employee_id, pin } = await request.json()
  if (!employee_id || !pin) {
    return NextResponse.json({ error: 'Campos obrigatórios.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: pinRecord } = await supabase
    .schema('mise')
    .from('user_pins')
    .select('pin_hash, role')
    .eq('employee_id', employee_id)
    .single()

  if (!pinRecord) {
    return NextResponse.json({ error: 'PIN não cadastrado.' }, { status: 401 })
  }

  const valid = await bcrypt.compare(String(pin), pinRecord.pin_hash)
  if (!valid) {
    return NextResponse.json({ error: 'PIN incorreto.' }, { status: 401 })
  }

  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()

  const { data: session, error } = await supabase
    .schema('mise')
    .from('sessions')
    .insert({ employee_id, role: pinRecord.role, expires_at: expiresAt })
    .select('id')
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Erro ao criar sessão.' }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('mise-session', session.id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 43200,
    path: '/',
  })
  return response
}
