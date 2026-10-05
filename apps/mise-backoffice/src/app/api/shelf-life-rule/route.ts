import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const metodo = searchParams.get('metodo')
  const categoria = searchParams.get('categoria')
  const ingredient_id = searchParams.get('ingredient_id')

  if (!metodo) {
    return NextResponse.json({ error: 'metodo é obrigatório.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 1. Validade customizada por ingrediente (Suflex)
  if (ingredient_id) {
    const { data: custom } = await supabase
      .schema('mise')
      .from('ingredient_shelf_life')
      .select('prazo_horas')
      .eq('ingredient_id', ingredient_id)
      .eq('metodo_conservacao', metodo)
      .single()

    if (custom) {
      return NextResponse.json({ prazo_horas: custom.prazo_horas, source: 'custom' })
    }
  }

  // 2. Fallback ANVISA por categoria
  if (categoria) {
    const { data } = await supabase
      .schema('mise')
      .from('shelf_life_rules')
      .select('prazo_horas')
      .eq('categoria', categoria)
      .eq('metodo_conservacao', metodo)
      .single()

    if (data) {
      return NextResponse.json({ prazo_horas: data.prazo_horas, source: 'anvisa' })
    }
  }

  return NextResponse.json({ error: 'not_found' }, { status: 404 })
}
