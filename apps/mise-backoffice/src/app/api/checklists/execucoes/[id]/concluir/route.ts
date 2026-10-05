import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function classificar(pct: number): string {
  if (pct < 50) return 'Crítico'
  if (pct < 60) return 'Ruim'
  if (pct < 75) return 'Regular'
  if (pct < 90) return 'Bom'
  return 'Excelente'
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: execution_id } = await params
  const body = await request.json().catch(() => ({}))
  const geo_fim_lat = body?.geo_fim_lat ?? null
  const geo_fim_lng = body?.geo_fim_lng ?? null

  const supabase = createServiceClient()

  const { data: execucao, error: execError } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .select('template_id')
    .eq('id', execution_id)
    .single()

  if (execError) return NextResponse.json({ error: execError.message }, { status: 404 })

  const [{ data: template }, { data: items }, { data: respostas }] = await Promise.all([
    supabase.schema('mise').from('checklist_templates')
      .select('modulo')
      .eq('id', execucao.template_id)
      .single(),
    supabase.schema('mise').from('checklist_template_items')
      .select('id, topico_ordem, topico_nome, tipo_resposta, opcoes, peso')
      .eq('template_id', execucao.template_id),
    supabase.schema('mise').from('checklist_responses')
      .select('item_id, resposta, nao_aplicavel')
      .eq('execution_id', execution_id),
  ])

  const naSet = new Set((respostas ?? []).filter(r => r.nao_aplicavel).map(r => r.item_id))
  const respostasMap = Object.fromEntries((respostas ?? []).map(r => [r.item_id, r]))

  let pontuacaoTotal = 0
  let pontuacaoObtida = 0
  let percentual = 0
  const topicoResults: { topico_ordem: number; topico_nome: string; percentual: number }[] = []

  type ItemRow = { id: string; topico_ordem: number | null; topico_nome: string | null; tipo_resposta: string; opcoes: unknown; peso: number | null }
  const itemList: ItemRow[] = (items ?? []) as ItemRow[]

  if (template?.modulo === 'CRIVO') {
    // Topic-weighted scoring: each topic contributes equally
    const topicoMap = new Map<number, { nome: string; items: ItemRow[] }>()
    for (const item of itemList) {
      const ordem = item.topico_ordem ?? 0
      const entry = topicoMap.get(ordem) ?? { nome: item.topico_nome ?? `Tópico ${ordem}`, items: [] }
      entry.items.push(item)
      topicoMap.set(ordem, entry)
    }

    let totalParticipantes = 0
    let totalObtido = 0

    for (const [topico_ordem, { nome: topico_nome, items: topItems }] of topicoMap) {
      const pontuaveis = topItems.filter(it => (it.peso ?? 1) > 0 && !naSet.has(it.id))
      if (pontuaveis.length === 0) continue // tópico não participa

      let conformes = 0
      for (const item of pontuaveis) {
        const r = respostasMap[item.id]
        if (!r?.resposta) continue
        switch (item.tipo_resposta) {
          case 'sim_nao':
            if (r.resposta.valor === 'sim') conformes++
            break
          case 'checklist_multiplo': {
            const opcoes = Array.isArray(item.opcoes) ? item.opcoes : []
            const selecionados = Array.isArray(r.resposta.selecionados) ? r.resposta.selecionados : []
            if (opcoes.length > 0 && selecionados.length === opcoes.length) conformes++
            break
          }
          case 'assinatura':
            if (r.resposta.assinatura) conformes++
            break
          default:
            if (Object.keys(r.resposta).length > 0) conformes++
        }
      }

      const topico_percentual = conformes / pontuaveis.length
      const topico_pct_rounded = Math.round(topico_percentual * 10000) / 100
      topicoResults.push({ topico_ordem, topico_nome, percentual: topico_pct_rounded })
      totalParticipantes++
      totalObtido += topico_percentual
    }

    pontuacaoTotal = totalParticipantes
    pontuacaoObtida = Math.round(totalObtido * 10000) / 10000
    percentual = totalParticipantes > 0
      ? Math.round((totalObtido / totalParticipantes) * 10000) / 100
      : 0
  } else {
    // RITMO: original flat weighted scoring
    for (const item of itemList) {
      if ((item.peso ?? 1) === 0 || naSet.has(item.id)) continue
      const peso = item.peso ?? 1
      pontuacaoTotal += peso
      const r = respostasMap[item.id]
      if (!r?.resposta) continue
      switch (item.tipo_resposta) {
        case 'sim_nao':
          if (r.resposta.valor === 'sim') pontuacaoObtida += peso
          break
        case 'checklist_multiplo': {
          const opcoes = Array.isArray(item.opcoes) ? item.opcoes : []
          const selecionados = Array.isArray(r.resposta.selecionados) ? r.resposta.selecionados : []
          if (opcoes.length > 0) pontuacaoObtida += (selecionados.length / opcoes.length) * peso
          break
        }
        case 'assinatura':
          if (r.resposta.assinatura) pontuacaoObtida += peso
          break
        default:
          if (Object.keys(r.resposta).length > 0) pontuacaoObtida += peso
      }
    }
    percentual = pontuacaoTotal > 0 ? Math.round((pontuacaoObtida / pontuacaoTotal) * 10000) / 100 : 0
  }

  const updatePayload: Record<string, unknown> = {
    status: 'concluido',
    pontuacao_total: pontuacaoTotal,
    pontuacao_obtida: pontuacaoObtida,
    percentual,
    concluido_em: new Date().toISOString(),
  }
  if (geo_fim_lat != null) updatePayload.geo_fim_lat = geo_fim_lat
  if (geo_fim_lng != null) updatePayload.geo_fim_lng = geo_fim_lng

  const { error } = await supabase
    .schema('mise')
    .from('checklist_executions')
    .update(updatePayload)
    .eq('id', execution_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Persist per-topic scores for CRIVO
  if (topicoResults.length > 0) {
    await supabase.schema('mise').from('checklist_execution_topicos')
      .upsert(
        topicoResults.map(t => ({
          execution_id,
          topico_ordem: t.topico_ordem,
          topico_nome: t.topico_nome,
          percentual: t.percentual,
        })),
        { onConflict: 'execution_id,topico_ordem' }
      )
  }

  return NextResponse.json({
    ok: true,
    pontuacao_total: pontuacaoTotal,
    pontuacao_obtida: pontuacaoObtida,
    percentual,
    classificacao: classificar(percentual),
    topicos: topicoResults.sort((a, b) => a.topico_ordem - b.topico_ordem),
  })
}
