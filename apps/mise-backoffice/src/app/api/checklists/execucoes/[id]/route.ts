import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: execucao, error } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: respostas } = await supabase
    .schema('mise')
    .from('checklist_responses')
    .select('*')
    .eq('execution_id', id)

  return NextResponse.json({ execucao, respostas: respostas ?? [] })
}
