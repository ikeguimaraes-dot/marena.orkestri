import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canAccessUnit } from '@/app/api/relatorio-diario/_auth'

async function getRelatorio(supabase: ReturnType<typeof createServiceClient>, unitId: string, dataParam: string) {
  const { data } = await supabase
    .from('op_relatorio_diario').select('id, status').eq('unit_id', unitId).eq('data', dataParam).single()
  return data
}

// PUT — campos de portaria ficam em op_relatorio_periodo (não há tabela op_portaria)
export async function PUT(request: Request, { params }: { params: Promise<{ data: string }> }) {
  const { data: dataParam } = await params
  const body = await request.json()
  const { unit_id, periodo, reservas, no_show, passantes } = body

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })
  if (!periodo) return NextResponse.json({ error: 'periodo obrigatório.' }, { status: 400 })

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()
  const relatorio = await getRelatorio(supabase, unit_id, dataParam)
  if (!relatorio) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  if (relatorio.status === 'enviado') return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })

  const { data, error } = await supabase
    .from('op_relatorio_periodo')
    .upsert(
      {
        relatorio_id: relatorio.id,
        periodo,
        portaria_reservas_previstas: reservas !== undefined ? parseInt(reservas) : null,
        portaria_noshow_qty: no_show !== undefined ? parseInt(no_show) : null,
        portaria_passantes: passantes !== undefined ? parseInt(passantes) : null,
      },
      { onConflict: 'relatorio_id,periodo' }
    )
    .select('id, portaria_reservas_previstas, portaria_noshow_qty, portaria_passantes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — adicionar uma desistência diretamente no relatorio (sem op_portaria intermediária)
// introspect confirmou: op_portaria_desistencia usa relatorio_id, não portaria_id
export async function POST(request: Request, { params }: { params: Promise<{ data: string }> }) {
  const { data: dataParam } = await params
  const body = await request.json()
  const { unit_id, motivo, pax_perdido, periodo } = body

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()
  const relatorio = await getRelatorio(supabase, unit_id, dataParam)
  if (!relatorio) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  if (relatorio.status === 'enviado') return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })

  const { data, error } = await supabase
    .from('op_portaria_desistencia')
    .insert({
      relatorio_id: relatorio.id,
      motivo: motivo?.trim() ?? null,
      pax_perdido: pax_perdido ? parseInt(pax_perdido) : null,
      periodo: periodo ?? null,
      tipo: 'desistencia',
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE — remover desistência individual
export async function DELETE(request: Request, { params }: { params: Promise<{ data: string }> }) {
  const { data: dataParam } = await params
  const { searchParams } = new URL(request.url)
  const unit_id = searchParams.get('unit_id')
  const id = searchParams.get('id')

  if (!unit_id || !id) return NextResponse.json({ error: 'unit_id e id obrigatórios.' }, { status: 400 })

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()
  const relatorio = await getRelatorio(supabase, unit_id, dataParam)
  if (!relatorio) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  if (relatorio.status === 'enviado') return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })

  const { error } = await supabase
    .from('op_portaria_desistencia').delete().eq('id', id).eq('relatorio_id', relatorio.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
