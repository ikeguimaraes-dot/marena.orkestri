import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const unit_id = searchParams.get('unit_id')

  const supabase = createServiceClient()
  let query = supabase.schema('mise').from('print_points').select('id, name, icone, ativo').eq('ativo', true)
  if (unit_id) query = query.eq('unit_id', unit_id)

  const { data } = await query.order('name')
  return NextResponse.json({ print_points: data ?? [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.unit_id || !body.name?.trim()) {
    return NextResponse.json({ error: 'unit_id e name são obrigatórios.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('mise')
    .from('print_points')
    .insert(body)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data.id })
}
