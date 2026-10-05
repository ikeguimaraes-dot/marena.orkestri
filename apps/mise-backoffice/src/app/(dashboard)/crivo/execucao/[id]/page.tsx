import { createServiceClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getMiseSession } from '@/lib/session'
import { CrivoExecucaoClient } from './_components/crivo-execucao-client'

function classificar(pct: number): string {
  if (pct < 50) return 'Crítico'
  if (pct < 60) return 'Ruim'
  if (pct < 75) return 'Regular'
  if (pct < 90) return 'Bom'
  return 'Excelente'
}

export default async function CrivoExecucaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/')

  const { id } = await params
  const supabase = createServiceClient()

  const { data: execucao } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .select('id, template_id, unit_id, local_id, status')
    .eq('id', id)
    .single()

  if (!execucao) notFound()

  if (execucao.status === 'concluido') {
    redirect(execucao.local_id ? `/crivo/${execucao.local_id}` : '/crivo')
  }

  // Mark agendado → em_andamento
  if (execucao.status === 'agendado') {
    await supabase
      .schema('mise')
      .from('checklist_executions')
      .update({ status: 'em_andamento', iniciado_em: new Date().toISOString() })
      .eq('id', id)
  }

  const [{ data: template }, { data: itemsRaw }, { data: respostas }, notaAnteriorResult] = await Promise.all([
    supabase.schema('mise').from('checklist_templates').select('nome').eq('id', execucao.template_id).single(),
    supabase.schema('mise').from('checklist_template_items')
      .select('id, ordem, titulo, descricao, tipo_resposta, opcoes, peso, requer_comentario, criterio_regramento, requer_foto, topico_ordem, topico_nome')
      .eq('template_id', execucao.template_id)
      .order('ordem'),
    supabase.schema('mise').from('checklist_responses')
      .select('item_id, resposta, comentario, nao_aplicavel, foto_url')
      .eq('execution_id', id),
    execucao.local_id
      ? supabase.schema('mise').from('checklist_executions')
          .select('percentual, concluido_em')
          .eq('local_id', execucao.local_id)
          .eq('template_id', execucao.template_id)
          .eq('status', 'concluido')
          .neq('id', id)
          .order('concluido_em', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!template) notFound()

  const items = (itemsRaw ?? []).map(item => ({
    ...item,
    descricao: item.descricao ?? null,
    requer_comentario: String(item.requer_comentario ?? 'nao'),
    criterio_regramento: (item.criterio_regramento as string | null) ?? null,
    requer_foto: String(item.requer_foto ?? 'nao'),
    topico_ordem: item.topico_ordem ?? null,
    topico_nome: (item.topico_nome as string | null) ?? null,
  }))

  const notaAnteriorData = notaAnteriorResult.data
  const notaAnterior = notaAnteriorData?.percentual != null
    ? {
        percentual: notaAnteriorData.percentual as number,
        classificacao: classificar(notaAnteriorData.percentual as number),
        data: (notaAnteriorData.concluido_em as string)?.slice(0, 10) ?? '',
      }
    : undefined

  return (
    <CrivoExecucaoClient
      executionId={id}
      localId={execucao.local_id ?? ''}
      templateNome={template.nome}
      items={items}
      existingRespostas={(respostas ?? []).map(r => ({
        item_id: r.item_id,
        resposta: r.resposta as Record<string, unknown> | null,
        comentario: r.comentario,
        nao_aplicavel: r.nao_aplicavel,
        foto_url: r.foto_url,
      }))}
      notaAnterior={notaAnterior}
    />
  )
}
