import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('mise-session')?.value

  if (sessionId) {
    const supabase = createServiceClient()
    await supabase.schema('mise').from('sessions').delete().eq('id', sessionId)
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('mise-session', '', { maxAge: 0, path: '/' })
  return response
}
