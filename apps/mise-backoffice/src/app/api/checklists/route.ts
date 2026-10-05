import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const unit_id = searchParams.get('unit_id')

  const supabase = createServiceClient()
  let query = supabase.schema('mise').from('checklist_templates').select('*').eq('ativo', true)
  if (unit_id) query = query.eq('unit_id', unit_id)

  const { data, error } = await query.order('nome')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(request: Request) {
  const { nome, tipo, descricao, unit_id, itens, modulo, categoria } = await request.json()
  if (!nome?.trim()) {
    return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 })
  }
  const supabase = createServiceClient()

  const { data: template, error: templateError } = await supabase
    .schema('mise')
    .from('checklist_templates')
    .insert({
      nome: nome.trim(),
      tipo: tipo ?? null,
      descricao: descricao ?? null,
      unit_id: unit_id ?? null,
      ativo: true,
      modulo: modulo ?? 'RITMO',
      categoria: categoria ?? null,
    })
    .select('id')
    .single()
  if (templateError) return NextResponse.json({ error: templateError.message }, { status: 400 })

  if (Array.isArray(itens) && itens.length > 0) {
    const rows = itens.map((item: Record<string, unknown>, i: number) => ({
      template_id: template.id,
      titulo: String(item.titulo ?? '').trim(),
      descricao: item.descricao ? String(item.descricao).trim() : null,
      tipo_resposta: item.tipo_resposta ?? 'sim_nao',
      opcoes: item.opcoes ?? null,
      peso: typeof item.peso === 'number' ? item.peso : 1,
      ordem: typeof item.ordem === 'number' ? item.ordem : i + 1,
      criterio_regramento: item.criterio_regramento ? String(item.criterio_regramento).trim() : null,
      requer_foto: item.requer_foto ?? 'nao',
    }))
    const { error: itemsError } = await supabase
      .schema('mise')
      .from('checklist_template_items')
      .insert(rows)
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 })
  }

  return NextResponse.json({ id: template.id }, { status: 201 })
}
