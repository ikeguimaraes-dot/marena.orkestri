import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: template_id } = await params
  const body = await request.json()

  if (!body.titulo?.trim()) {
    return NextResponse.json({ error: 'título é obrigatório' }, { status: 400 })
  }
  if (!body.tipo_resposta) {
    return NextResponse.json({ error: 'tipo_resposta é obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .schema('mise')
    .from('checklist_template_items')
    .select('ordem')
    .eq('template_id', template_id)
    .order('ordem', { ascending: false })
    .limit(1)

  const nextOrdem = (existing?.[0]?.ordem ?? 0) + 1

  const { data, error } = await supabase
    .schema('mise')
    .from('checklist_template_items')
    .insert({
      template_id,
      titulo: body.titulo.trim(),
      descricao: body.descricao?.trim() || null,
      tipo_resposta: body.tipo_resposta,
      opcoes: body.opcoes ?? null,
      ordem: nextOrdem,
      peso: body.peso ?? 1,
      criterio_regramento: body.criterio_regramento?.trim() || null,
      requer_foto: body.requer_foto ?? 'nao',
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ item: data }, { status: 201 })
}
