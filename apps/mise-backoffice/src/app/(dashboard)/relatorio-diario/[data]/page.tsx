import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { RelatorioClient } from './_components/relatorio-client'

export default async function RelatorioPage({
  params,
  searchParams,
}: {
  params: Promise<{ data: string }>
  searchParams: Promise<{ unit_id?: string }>
}) {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role === 'cozinheiro') redirect('/')

  const { data: dataParam } = await params
  const { unit_id } = await searchParams
  if (!unit_id) redirect('/relatorio-diario')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataParam)) redirect('/relatorio-diario')

  const supabase = createServiceClient()

  // getOrCreate — garante que o pai existe antes de qualquer filho gravar
  const { data: existing } = await supabase
    .from('op_relatorio_diario')
    .select('*')
    .eq('unit_id', unit_id)
    .eq('data', dataParam)
    .single()

  let relatorio = existing
  if (!relatorio) {
    const { data: created } = await supabase
      .from('op_relatorio_diario')
      .insert({ unit_id, data: dataParam, status: 'rascunho' })
      .select('*')
      .single()
    relatorio = created
  }
  if (!relatorio) redirect('/relatorio-diario')

  const [periodosRes, unitConfigRes, unitRes, feedbacksRes, avaliacoesRes, desistenciasRes, colaboradoresRes, faltasRes, horariosPadraoRes, itens86Res, ocorrenciasRhRes] = await Promise.all([
    supabase.from('op_relatorio_periodo').select('*').eq('relatorio_id', relatorio.id),
    supabase.from('op_unit_config').select('periodos, pax_por_genero').eq('unit_id', unit_id).single(),
    supabase.from('units').select('name').eq('id', unit_id).single(),
    supabase.from('op_feedback_cliente').select('id, tipo, produto, categoria, texto').eq('relatorio_id', relatorio.id),
    supabase.from('op_avaliacao_setor').select('periodo, sequencia, setor, nota, observacao').eq('relatorio_id', relatorio.id),
    supabase.from('op_portaria_desistencia').select('id, periodo, motivo, pax_perdido').eq('relatorio_id', relatorio.id),
    supabase.from('employees').select('id, nome, sobrenome, funcao, cpf').eq('ativo', true).order('nome'),
    supabase.from('op_falta_equipe').select('periodo, sequencia, area, lider_turno, houve_falta, nomes').eq('relatorio_id', relatorio.id),
    supabase.from('op_horario_padrao').select('dia_semana, periodo, hora_abertura, hora_fechamento').eq('unit_id', unit_id),
    supabase.from('op_86').select('id, produto_nome, motivo').eq('relatorio_id', relatorio.id),
    supabase.from('op_rh_ocorrencia').select('id, nome, tipo, cpf, observacao').eq('relatorio_id', relatorio.id),
  ])

  return (
    <RelatorioClient
      relatorio={relatorio}
      periodos={periodosRes.data ?? []}
      unitConfigPeriodos={(unitConfigRes.data?.periodos as string[] | null) ?? ['almoco', 'jantar']}
      unitId={unit_id}
      unitName={unitRes.data?.name ?? ''}
      dataParam={dataParam}
      role={session.role}
      feedbacks={feedbacksRes.data ?? []}
      avaliacoesSetor={avaliacoesRes.data ?? []}
      desistencias={desistenciasRes.data ?? []}
      colaboradores={colaboradoresRes.data ?? []}
      faltas={faltasRes.data ?? []}
      horariosPadrao={horariosPadraoRes.data ?? []}
      itens86={itens86Res.data ?? []}
      ocorrenciasRh={ocorrenciasRhRes.data ?? []}
    />
  )
}
