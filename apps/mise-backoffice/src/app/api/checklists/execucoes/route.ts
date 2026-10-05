import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const unit_id = searchParams.get('unit_id')
  const status = searchParams.get('status')
  const template_id = searchParams.get('template_id')

  const supabase = createServiceClient()
  let query = supabase.schema('mise').from('checklist_executions').select('*')
  if (unit_id) query = query.eq('unit_id', unit_id)
  if (status) query = query.eq('status', status)
  if (template_id) query = query.eq('template_id', template_id)

  const { data, error } = await query.order('iniciado_em', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ execucoes: data ?? [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.template_id) {
    return NextResponse.json({ error: 'template_id é obrigatório' }, { status: 400 })
  }
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .insert({
      template_id: body.template_id,
      unit_id: body.unit_id ?? null,
      turno: body.turno ?? null,
      status: 'em_andamento',
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
