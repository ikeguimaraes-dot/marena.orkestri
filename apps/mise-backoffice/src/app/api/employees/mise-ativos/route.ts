import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('employees')
    .select('id, nome, departamento')
    .eq('ativo', true)
    .eq('mise_ativo', true)
    .order('nome')
  return NextResponse.json(data ?? [])
}
