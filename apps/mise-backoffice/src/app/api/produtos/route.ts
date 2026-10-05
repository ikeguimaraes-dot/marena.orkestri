import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()

  if (!body.nome?.trim() || !body.group_id || !body.categoria || !body.unidade_padrao) {
    return NextResponse.json({ error: 'Campos obrigatórios: nome, group_id, categoria, unidade_padrao.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('ingredients')
    .insert(body)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data.id })
}
