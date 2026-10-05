import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canAccessUnit } from './_auth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const unit_id = searchParams.get('unit_id')

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('op_relatorio_diario')
    .select('id, data, status, created_at')
    .eq('unit_id', unit_id)
    .order('data', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ relatorios: data ?? [] })
}
