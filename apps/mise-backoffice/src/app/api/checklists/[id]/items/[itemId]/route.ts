import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params
  const body = await request.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .schema('mise')
    .from('checklist_template_items')
    .update(body)
    .eq('id', itemId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { itemId } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .schema('mise')
    .from('checklist_template_items')
    .delete()
    .eq('id', itemId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
