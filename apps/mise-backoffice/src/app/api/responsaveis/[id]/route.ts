import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const supabase = createServiceClient()

  const update: Record<string, string | boolean> = {}
  if (typeof body.nome === 'string') {
    const nome = body.nome.trim()
    if (!nome) return NextResponse.json({ error: 'nome não pode ser vazio.' }, { status: 400 })
    update.nome = nome
  }
  if (typeof body.ativo === 'boolean') update.ativo = body.ativo

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.schema('mise').from('responsaveis').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (Array.isArray(body.unit_ids)) {
    const unitIds: string[] = body.unit_ids

    const { error: deleteError } = await supabase
      .schema('mise')
      .from('responsavel_unidades')
      .delete()
      .eq('responsavel_id', id)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })

    if (unitIds.length > 0) {
      const { error: insertError } = await supabase
        .schema('mise')
        .from('responsavel_unidades')
        .insert(unitIds.map(unit_id => ({ responsavel_id: id, unit_id })))
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase.schema('mise').from('responsaveis').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
