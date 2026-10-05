import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canAccessUnit } from '../_auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ data: string }> }
) {
  const { data: dataParam } = await params
  const { searchParams } = new URL(request.url)
  const unit_id = searchParams.get('unit_id')

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()

  // getOrCreate — idempotente
  const { data: existing } = await supabase
    .from('op_relatorio_diario')
    .select('*')
    .eq('unit_id', unit_id)
    .eq('data', dataParam)
    .single()

  if (existing) return NextResponse.json({ relatorio: existing })

  const { data: created, error } = await supabase
    .from('op_relatorio_diario')
    .insert({ unit_id, data: dataParam, status: 'rascunho' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ relatorio: created }, { status: 201 })
}
