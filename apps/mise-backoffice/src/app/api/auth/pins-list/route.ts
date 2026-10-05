import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .schema('mise')
    .from('user_pins')
    .select('employee_id, role')
  return NextResponse.json(data ?? [])
}
