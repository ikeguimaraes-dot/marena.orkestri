import { getMiseSession } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getMiseSession()
  if (!session) return NextResponse.json({ session: null })
  return NextResponse.json({ session })
}
