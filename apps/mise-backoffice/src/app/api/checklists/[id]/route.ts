import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: template, error } = await supabase
    .schema('mise')
    .from('checklist_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: items } = await supabase
    .schema('mise')
    .from('checklist_template_items')
    .select('*')
    .eq('template_id', id)
    .eq('ativo', true)
    .order('ordem')

  return NextResponse.json({ template, items: items ?? [] })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const supabase = createServiceClient()
  const { error } = await supabase
    .schema('mise')
    .from('checklist_templates')
    .update(body)
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase
    .schema('mise')
    .from('checklist_templates')
    .update({ ativo: false })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
