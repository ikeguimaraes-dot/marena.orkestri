import { createServiceClient } from '@/lib/supabase/server'
import { getMiseSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'

type Alerta = {
  id: string
  modulo: 'TURNO' | 'RITMO' | 'CRIVO'
  unidade: string
  severidade: 'critico' | 'atencao'
  titulo: string
  descricao: string
  data: string
  href: string
}

function addDias(dataStr: string, dias: number): string {
  const d = new Date(`${dataStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function fmtData(dataStr: string): string {
  if (!dataStr) return ''
  return new Date(`${dataStr}T12:00:00Z`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', timeZone: 'UTC',
  })
}

function brl(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default async function AlertasPage() {
  const session = await getMiseSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect('/relatorio-diario')

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const data14 = addDias(hoje, -14)
  const data7 = addDias(hoje, -7)
  const data3 = addDias(hoje, -3)
  const data60 = addDias(hoje, -60)
  const crivo14Str = `${data14}T00:00:00Z`

  const supabase = createServiceClient()

  // Round 1: reference data + unit-independent queries (all parallel)
  const [
    { data: unitsRaw },
    { data: locaisRaw },
    { data: templatesRaw },
    { data: crivoExecsRaw },
    { data: baixoRitmoRaw },
  ] = await Promise.all([
    supabase.from('units').select('id, name').eq('active', true),
    supabase.schema('mise').from('crivo_locais').select('id, nome').eq('ativo', true),
    supabase.schema('mise').from('checklist_templates').select('id, nome, modulo').eq('ativo', true),
    // CRIVO: 60 days for queda comparison (ordered desc → pairs are [i] vs [i+1])
    supabase.schema('mise').from('checklist_executions')
      .select('id, local_id, template_id, percentual, concluido_em')
      .eq('status', 'concluido')
      .not('local_id', 'is', null)
      .gte('concluido_em', `${data60}T00:00:00Z`)
      .order('concluido_em', { ascending: false }),
    // RITMO: low-scoring executions in last 14 days
    supabase.schema('mise').from('checklist_executions')
      .select('id, unit_id, template_id, percentual, concluido_em')
      .eq('status', 'concluido')
      .is('local_id', null)
      .lt('percentual', 70)
      .gte('concluido_em', `${data14}T00:00:00Z`)
      .order('concluido_em', { ascending: false }),
  ])

  const units = unitsRaw ?? []
  const unitIds = units.map(u => u.id)
  const unitMap = new Map(units.map(u => [u.id, u.name]))
  const localMap = new Map((locaisRaw ?? []).map(l => [l.id, l.nome as string]))
  const templateMap = new Map((templatesRaw ?? []).map(t => [t.id, { nome: t.nome as string, modulo: t.modulo as string | null }]))
  const crivoExecs = crivoExecsRaw ?? []
  const baixoRitmo = baixoRitmoRaw ?? []

  // CRIVO execution IDs within the 14-day window (for topicos query)
  const crivoExecIds14 = crivoExecs
    .filter(e => e.concluido_em != null && e.concluido_em >= crivo14Str)
    .map(e => e.id)

  // Round 2: relatorios (depends on unitIds)
  const { data: relatoriosRaw } = unitIds.length
    ? await supabase.from('op_relatorio_diario')
        .select('id, unit_id, data, status')
        .in('unit_id', unitIds)
        .gte('data', data14)
        .lte('data', hoje)
    : { data: null }

  const relatorios = relatoriosRaw ?? []
  const relIds = relatorios.map(r => r.id)
  const relMap = new Map(relatorios.map(r => [r.id, r]))
  const rel7Ids = relatorios.filter(r => r.data >= data7).map(r => r.id)

  // Round 3: financial + occurrence data (all parallel, depends on relatorio IDs)
  const [
    periodosResult,
    avaliacoesResult,
    rhResult,
    op86Result,
    topicosCriticoResult,
  ] = await Promise.all([
    relIds.length
      ? supabase.from('op_relatorio_periodo')
          .select('relatorio_id, status, venda_total, taxa_servico, delivery, portaria')
          .in('relatorio_id', relIds)
      : { data: null },
    relIds.length
      ? supabase.from('op_avaliacao_setor')
          .select('relatorio_id, nota')
          .in('relatorio_id', relIds)
          .not('nota', 'is', null)
      : { data: null },
    relIds.length
      ? supabase.from('op_rh_ocorrencia')
          .select('id, relatorio_id, nome, tipo')
          .in('relatorio_id', relIds)
          .in('tipo', ['advertencia', 'desligamento'])
      : { data: null },
    rel7Ids.length
      ? supabase.from('op_86')
          .select('id, relatorio_id, produto_nome')
          .in('relatorio_id', rel7Ids)
      : { data: null },
    crivoExecIds14.length
      ? supabase.schema('mise').from('checklist_execution_topicos')
          .select('execution_id, topico_nome, percentual')
          .in('execution_id', crivoExecIds14)
          .eq('percentual', 0)
          .in('topico_nome', ['Documentações', 'Câmara Refrigerada', 'Câmara Congelada', 'EPIs'])
      : { data: null },
  ])

  const periodos = periodosResult.data ?? []
  const avaliacoes = avaliacoesResult.data ?? []
  const rhOcorrencias = rhResult.data ?? []
  const op86 = op86Result.data ?? []
  const topicosCritico = topicosCriticoResult.data ?? []

  // ─── Helpers ────────────────────────────────────────────────

  function calcFat(relId: string): number {
    return periodos
      .filter(p => p.relatorio_id === relId && p.status !== 'nao_se_aplica')
      .reduce((s, p) => s + (p.venda_total ?? 0) + (p.taxa_servico ?? 0) + (p.delivery ?? 0) + (p.portaria ?? 0), 0)
  }

  // ─── Build Alerts ────────────────────────────────────────────

  const alertas: Alerta[] = []

  // ── TURNO: Relatório vencido (últimos 3 dias, excluindo hoje) ──
  for (const r of relatorios) {
    if (r.data >= hoje || r.data < data3) continue
    if (r.status === 'enviado' || r.status === 'auditado') continue
    const unidade = unitMap.get(r.unit_id) ?? r.unit_id
    alertas.push({
      id: `turno-vencido-${r.unit_id}-${r.data}`,
      modulo: 'TURNO',
      unidade,
      severidade: 'critico',
      titulo: `Relatório de ${fmtData(r.data)} não enviado`,
      descricao: `O relatório diário de ${unidade} não foi finalizado.`,
      data: r.data,
      href: `/relatorio-diario/${r.data}?unit_id=${r.unit_id}`,
    })
  }

  // ── TURNO: Nota Geral < 3 ──
  const notasByRel = new Map<string, number[]>()
  for (const a of avaliacoes) {
    if (a.nota == null) continue
    const arr = notasByRel.get(a.relatorio_id) ?? []
    arr.push(a.nota as number)
    notasByRel.set(a.relatorio_id, arr)
  }
  for (const [relId, notas] of notasByRel) {
    const media = notas.reduce((s, n) => s + n, 0) / notas.length
    if (media >= 3) continue
    const rel = relMap.get(relId)
    if (!rel) continue
    const unidade = unitMap.get(rel.unit_id) ?? rel.unit_id
    alertas.push({
      id: `turno-nota-${rel.unit_id}-${rel.data}`,
      modulo: 'TURNO',
      unidade,
      severidade: 'critico',
      titulo: `Nota da operação em ${media.toFixed(1)}`,
      descricao: `Média das avaliações de setor abaixo de 3 em ${unidade}.`,
      data: rel.data,
      href: `/relatorio-diario/${rel.data}?unit_id=${rel.unit_id}`,
    })
  }

  // ── TURNO: Faturamento abaixo de 85% da mesma semana anterior ──
  const relByUnitData = new Map<string, string>()
  for (const r of relatorios) relByUnitData.set(`${r.unit_id}|${r.data}`, r.id)

  for (const unitId of unitIds) {
    for (let i = 1; i <= 7; i++) {
      const dia = addDias(hoje, -i)
      const diaAnt = addDias(dia, -7)
      const relIdDia = relByUnitData.get(`${unitId}|${dia}`)
      const relIdAnt = relByUnitData.get(`${unitId}|${diaAnt}`)
      if (!relIdDia || !relIdAnt) continue
      const fatDia = calcFat(relIdDia)
      const fatAnt = calcFat(relIdAnt)
      if (fatDia <= 0 || fatAnt <= 0 || fatDia >= fatAnt * 0.85) continue
      const queda = Math.round((1 - fatDia / fatAnt) * 100)
      const diaSemana = new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' })
      const unidade = unitMap.get(unitId) ?? unitId
      alertas.push({
        id: `turno-fat-${unitId}-${dia}`,
        modulo: 'TURNO',
        unidade,
        severidade: 'atencao',
        titulo: `Faturamento ${queda}% abaixo da mesma ${diaSemana} anterior`,
        descricao: `${brl(fatDia)} vs ${brl(fatAnt)} na semana passada.`,
        data: dia,
        href: `/relatorio-diario/${dia}?unit_id=${unitId}`,
      })
    }
  }

  // ── TURNO: Advertência / Desligamento no RH ──
  for (const oc of rhOcorrencias) {
    const rel = relMap.get(oc.relatorio_id)
    if (!rel) continue
    const unidade = unitMap.get(rel.unit_id) ?? rel.unit_id
    const tipoLabel = oc.tipo === 'desligamento' ? 'Desligamento' : 'Advertência'
    alertas.push({
      id: `turno-rh-${oc.id}`,
      modulo: 'TURNO',
      unidade,
      severidade: oc.tipo === 'desligamento' ? 'critico' : 'atencao',
      titulo: `${oc.nome ?? 'Colaborador'} — ${tipoLabel}`,
      descricao: `Ocorrência registrada em ${unidade} em ${fmtData(rel.data)}.`,
      data: rel.data,
      href: `/relatorio-diario/${rel.data}?unit_id=${rel.unit_id}`,
    })
  }

  // ── TURNO: Produto no 86 ≥ 3× na semana ──
  const prodCount = new Map<string, { unit_id: string; produto: string; count: number; dataMax: string }>()
  for (const item of op86) {
    const rel = relMap.get(item.relatorio_id)
    if (!rel) continue
    const key = `${rel.unit_id}|${item.produto_nome}`
    const e = prodCount.get(key) ?? { unit_id: rel.unit_id, produto: item.produto_nome as string, count: 0, dataMax: rel.data }
    e.count++
    if (rel.data > e.dataMax) e.dataMax = rel.data
    prodCount.set(key, e)
  }
  for (const e of prodCount.values()) {
    if (e.count < 3) continue
    const unidade = unitMap.get(e.unit_id) ?? e.unit_id
    alertas.push({
      id: `turno-86-${e.unit_id}-${e.produto.replace(/\s+/g, '_').slice(0, 40)}`,
      modulo: 'TURNO',
      unidade,
      severidade: 'atencao',
      titulo: `"${e.produto}" em falta ${e.count}× essa semana`,
      descricao: `Item registrado repetidamente no 86 em ${unidade}.`,
      data: e.dataMax,
      href: `/relatorio-diario/${e.dataMax}?unit_id=${e.unit_id}`,
    })
  }

  // ── RITMO: Execução abaixo de 70% ──
  for (const ex of baixoRitmo) {
    if (!ex.concluido_em) continue
    const tmpl = templateMap.get(ex.template_id)
    if (!tmpl || tmpl.modulo === 'CRIVO') continue
    const unidade = ex.unit_id ? (unitMap.get(ex.unit_id) ?? 'Unidade') : 'Global'
    const data = ex.concluido_em.slice(0, 10)
    alertas.push({
      id: `ritmo-baixo-${ex.id}`,
      modulo: 'RITMO',
      unidade,
      severidade: 'atencao',
      titulo: `${tmpl.nome} concluído com ${Number(ex.percentual).toFixed(0)}%`,
      descricao: `Checklist com resultado abaixo de 70% em ${unidade}.`,
      data,
      href: `/checklists/historico`,
    })
  }

  // ── CRIVO: Nota abaixo de 60 (últimos 14 dias) ──
  for (const ex of crivoExecs) {
    if (!ex.concluido_em || ex.concluido_em < crivo14Str) continue
    if ((ex.percentual ?? 100) >= 60) continue
    const localNome = ex.local_id ? (localMap.get(ex.local_id) ?? ex.local_id) : 'Local'
    const tmpl = templateMap.get(ex.template_id)
    const data = ex.concluido_em.slice(0, 10)
    const classificacao = (ex.percentual ?? 0) < 50 ? 'Crítico' : 'Ruim'
    alertas.push({
      id: `crivo-baixo-${ex.id}`,
      modulo: 'CRIVO',
      unidade: localNome,
      severidade: 'critico',
      titulo: `${localNome} — ${Number(ex.percentual).toFixed(0)}% (${classificacao})`,
      descricao: `${tmpl?.nome ?? 'Auditoria'} realizada em ${fmtData(data)}.`,
      data,
      href: `/crivo/${ex.local_id}`,
    })
  }

  // ── CRIVO: Queda de 15+ pontos vs auditoria anterior ──
  const byLocalTemplate = new Map<string, typeof crivoExecs>()
  for (const ex of crivoExecs) {
    if (!ex.local_id) continue
    const key = `${ex.local_id}|${ex.template_id}`
    byLocalTemplate.set(key, [...(byLocalTemplate.get(key) ?? []), ex])
  }
  for (const [, exs] of byLocalTemplate) {
    // exs is sorted desc by concluido_em — exs[i] is newer than exs[i+1]
    for (let i = 0; i < exs.length - 1; i++) {
      const atual = exs[i]
      const anterior = exs[i + 1]
      if (!atual.concluido_em || atual.concluido_em < crivo14Str) continue
      if (atual.percentual == null || anterior.percentual == null) continue
      const queda = (anterior.percentual as number) - (atual.percentual as number)
      if (queda < 15) continue
      const localNome = atual.local_id ? (localMap.get(atual.local_id) ?? atual.local_id) : 'Local'
      const data = atual.concluido_em.slice(0, 10)
      alertas.push({
        id: `crivo-queda-${atual.id}`,
        modulo: 'CRIVO',
        unidade: localNome,
        severidade: 'critico',
        titulo: `${localNome} caiu ${Math.round(queda)} pontos desde a última auditoria`,
        descricao: `De ${Number(anterior.percentual).toFixed(0)}% para ${Number(atual.percentual).toFixed(0)}%.`,
        data,
        href: `/crivo/${atual.local_id}`,
      })
    }
  }

  // ── CRIVO: Tópico crítico zerado ──
  const crivoExecMap = new Map(crivoExecs.map(e => [e.id, e]))
  for (const t of topicosCritico) {
    const ex = crivoExecMap.get(t.execution_id)
    if (!ex || !ex.concluido_em) continue
    const localNome = ex.local_id ? (localMap.get(ex.local_id) ?? ex.local_id) : 'Local'
    const data = ex.concluido_em.slice(0, 10)
    alertas.push({
      id: `crivo-topico-${t.execution_id}-${String(t.topico_nome).replace(/\s+/g, '_')}`,
      modulo: 'CRIVO',
      unidade: localNome,
      severidade: 'critico',
      titulo: `${localNome} — ${t.topico_nome} zerado`,
      descricao: `Tópico crítico com 0% na auditoria de ${fmtData(data)}.`,
      data,
      href: `/crivo/${ex.local_id}`,
    })
  }

  // Sort: most recent first, then crítico before atencao
  alertas.sort((a, b) => {
    if (b.data !== a.data) return b.data.localeCompare(a.data)
    if (a.severidade === 'critico' && b.severidade !== 'critico') return -1
    if (b.severidade === 'critico' && a.severidade !== 'critico') return 1
    return 0
  })

  const criticos = alertas.filter(a => a.severidade === 'critico').length

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-ink">Central de Alertas</h1>
        <p className="text-sm text-ink-muted">
          {alertas.length === 0
            ? 'Nenhuma anomalia nos últimos 14 dias.'
            : `${alertas.length} alerta${alertas.length !== 1 ? 's' : ''} nos últimos 14 dias${criticos > 0 ? ` · ${criticos} crítico${criticos !== 1 ? 's' : ''}` : ''}`
          }
        </p>
      </div>

      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map(a => (
            <Link
              key={a.id}
              href={a.href}
              className={`block rounded-xl border p-4 transition-colors hover:bg-surface-raised/50 ${
                a.severidade === 'critico'
                  ? 'border-alert/40 bg-alert/5'
                  : 'border-warn/40 bg-warn/5'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-ink-faint">
                <span className="flex items-center gap-1.5">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${a.severidade === 'critico' ? 'bg-alert' : 'bg-warn'}`} />
                  {a.modulo} · {a.unidade}
                </span>
                <span>{fmtData(a.data)}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink">{a.titulo}</p>
              <p className="text-xs text-ink-muted">{a.descricao}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
