import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  const { employee_id, pin, role } = await request.json()

  if (!employee_id || !pin || !/^\d{4}$/.test(String(pin))) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const pin_hash = await bcrypt.hash(String(pin), 10)
  const supabase = createServiceClient()

  const { error } = await supabase
    .schema('mise')
    .from('user_pins')
    .upsert(
      { employee_id, pin_hash, role: role ?? 'cozinheiro', updated_at: new Date().toISOString() },
      { onConflict: 'employee_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
