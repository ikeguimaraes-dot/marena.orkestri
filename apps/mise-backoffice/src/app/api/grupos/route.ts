import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Nome obrigatório.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('groups')
    .insert({ ...body, slug: toSlug(body.name) })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data.id })
}
