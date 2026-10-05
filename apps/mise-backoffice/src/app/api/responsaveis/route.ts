import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const unit_id = searchParams.get('unit_id')
  const includeInativos = searchParams.get('all') === '1'

  const supabase = createServiceClient()

  let query = supabase
    .schema('mise')
    .from('responsaveis')
    .select('id, nome, ativo, created_at, responsavel_unidades(unit_id)')
    .order('nome')

  if (!includeInativos) query = query.eq('ativo', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let responsaveis = (data ?? []).map(r => ({
    id: r.id,
    nome: r.nome,
    ativo: r.ativo,
    created_at: r.created_at,
    unit_ids: (r.responsavel_unidades ?? []).map((ru: { unit_id: string }) => ru.unit_id),
  }))

  if (unit_id) responsaveis = responsaveis.filter(r => r.unit_ids.includes(unit_id))

  return NextResponse.json({ responsaveis })
}

export async function POST(request: Request) {
  const body = await request.json()
  const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
  const unitIds: string[] = Array.isArray(body.unit_ids) ? body.unit_ids : []

  if (!nome) {
    return NextResponse.json({ error: 'nome é obrigatório.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: responsavel, error } = await supabase
    .schema('mise')
    .from('responsaveis')
    .insert({ nome })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (unitIds.length > 0) {
    const { error: vinculosError } = await supabase
      .schema('mise')
      .from('responsavel_unidades')
      .insert(unitIds.map(unit_id => ({ responsavel_id: responsavel.id, unit_id })))

    if (vinculosError) {
      return NextResponse.json({ error: vinculosError.message }, { status: 400 })
    }
  }

  return NextResponse.json({ id: responsavel.id })
}
