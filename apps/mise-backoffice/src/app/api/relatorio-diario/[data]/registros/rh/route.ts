import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canAccessUnit } from '@/app/api/relatorio-diario/_auth'
import { OCORRENCIA_RH_TIPOS } from '@/app/api/relatorio-diario/_schema'

async function getRelatorio(supabase: ReturnType<typeof createServiceClient>, unitId: string, dataParam: string) {
  const { data } = await supabase
    .from('op_relatorio_diario').select('id, status').eq('unit_id', unitId).eq('data', dataParam).single()
  return data
}

function validarCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  return digits.length === 11
}

export async function POST(request: Request, { params }: { params: Promise<{ data: string }> }) {
  const { data: dataParam } = await params
  const body = await request.json()
  // introspect: tabela real = op_rh_ocorrencia; colunas: nome, cpf, setor, tipo, observacao
  const { unit_id, nome, cpf, tipo, observacao, setor } = body

  if (!unit_id) return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })
  if (!nome?.trim()) return NextResponse.json({ error: 'nome obrigatório.' }, { status: 400 })
  if (!OCORRENCIA_RH_TIPOS.includes(tipo)) return NextResponse.json({ error: 'tipo inválido.' }, { status: 400 })
  // cpf é NOT NULL em op_rh_ocorrencia — confirmado via introspecção
  if (!cpf) return NextResponse.json({ error: 'CPF obrigatório.' }, { status: 400 })
  if (!validarCpf(cpf)) return NextResponse.json({ error: 'CPF inválido — deve ter 11 dígitos.' }, { status: 400 })

  const auth = await canAccessUnit(unit_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()
  const relatorio = await getRelatorio(supabase, unit_id, dataParam)
  if (!relatorio) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 })
  if (relatorio.status === 'enviado') return NextResponse.json({ error: 'Relatório já enviado.' }, { status: 409 })

  const cpfDigits = cpf ? cpf.replace(/\D/g, '') : null

  const { data, error } = await supabase
    .from('op_rh_ocorrencia')
    .insert({
      relatorio_id: relatorio.id,
      nome: nome.trim(),
      cpf: cpfDigits,
      setor: setor ?? null,
      tipo,
      observacao: observacao?.trim() ?? null,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

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

  const { error } = await supabase.from('op_rh_ocorrencia').delete().eq('id', id).eq('relatorio_id', relatorio.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
