'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getBrowserClient } from '@maza/db/supabase/client'
import * as XLSX from 'xlsx'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type StatusVaga  = 'aberta' | 'fechada' | 'congelada'
type StatusPrazo = 'no_prazo' | 'atencao' | 'atrasado' | 'congelada'
type MotivoVaga  =
  | 'substituicao_desligamento'
  | 'aumento_hc'
  | 'abertura_casa'
  | 'adequacao_hc'
  | 'outro'

interface Vaga {
  id: string
  unit_id: string
  unit_name?: string
  brand_name?: string
  title: string
  department?: string
  status: StatusVaga
  status_prazo?: StatusPrazo
  motivo?: MotivoVaga
  recrutador?: string
  sla_dias?: number
  dias_corridos?: number
  horario?: string
  salario?: number
  fonte_recrutamento?: string
  candidato_aprovado?: string
  data_admissao?: string
  fechamento_previsto?: string
  observacoes?: string
  created_at: string
  total_logs?: number
}

interface LogEntry {
  id: string
  texto: string
  autor: string
  created_at: string
}

interface KPIs {
  abertas: number
  fechadas: number
  congeladas: number
  slaM: number
  atrasadas: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v?: number) =>
  v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

const diasLabel = (n?: number) => n != null ? `${n}d` : '—'

const SLA_BADGE: Record<StatusPrazo, { bg: string; text: string; label: string }> = {
  no_prazo:  { bg: 'bg-green-50',  text: 'text-green-700',  label: 'No prazo'  },
  atencao:   { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Atenção'   },
  atrasado:  { bg: 'bg-red-50',    text: 'text-red-700',    label: 'Atrasado'  },
  congelada: { bg: 'bg-blue-50',   text: 'text-blue-600',   label: 'Congelada' },
}

const MOTIVO_LABEL: Record<MotivoVaga, string> = {
  substituicao_desligamento: 'Substituição desligamento',
  aumento_hc:                'Aumento de HC',
  abertura_casa:             'Abertura de casa',
  adequacao_hc:              'Adequação de HC',
  outro:                     'Outro',
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function VagasPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getBrowserClient()! as any

  const [statusFiltro, setStatusFiltro] = useState<StatusVaga | 'todos'>('todos')
  const [unitFiltro,   setUnitFiltro]   = useState<string>('todos')
  const [recrutFiltro, setRecrutFiltro] = useState<string>('todos')
  const [search,       setSearch]       = useState('')

  const [vagas,    setVagas]    = useState<Vaga[]>([])
  const [units,    setUnits]    = useState<{ id: string; name: string }[]>([])
  const [recrutas, setRecrutas] = useState<string[]>([])
  const [kpis,     setKpis]     = useState<KPIs | null>(null)
  const [loading,  setLoading]  = useState(false)

  const [vagaSel,  setVagaSel]  = useState<Vaga | null>(null)
  const [logs,     setLogs]     = useState<LogEntry[]>([])
  const [novoLog,  setNovoLog]  = useState('')
  const [saving,   setSaving]   = useState(false)

  const [tab,       setTab]      = useState<'pipeline' | 'importar'>('pipeline')
  const [importLog, setImportLog] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load units ─────────────────────────────────────────────────────────────
  useEffect(() => {
    sb.from('units').select('id,name').order('name')
      .then(({ data }: { data: { id: string; name: string }[] | null }) => {
        if (data) setUnits(data)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load vagas ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    let q = sb
      .from('v_vagas_pipeline')
      .select('*')
      .order('created_at', { ascending: false })

    if (statusFiltro !== 'todos') q = q.eq('status', statusFiltro)
    if (unitFiltro   !== 'todos') q = q.eq('unit_id', unitFiltro)

    const { data } = await q
    const all = (data ?? []) as Vaga[]

    const filtered = all.filter(v => {
      if (recrutFiltro !== 'todos' && v.recrutador !== recrutFiltro) return false
      if (search) {
        const s = search.toLowerCase()
        return (v.title?.toLowerCase().includes(s) ||
                v.department?.toLowerCase().includes(s) ||
                v.candidato_aprovado?.toLowerCase().includes(s))
      }
      return true
    })

    setVagas(filtered)

    const abertas    = filtered.filter(v => v.status === 'aberta').length
    const fechadas   = filtered.filter(v => v.status === 'fechada').length
    const congeladas = filtered.filter(v => v.status === 'congelada').length
    const atrasadas  = filtered.filter(v => v.status_prazo === 'atrasado').length
    const abertasComSla = filtered.filter(v => v.status === 'aberta' && v.dias_corridos != null)
    const slaM = abertasComSla.length
      ? Math.round(abertasComSla.reduce((s, v) => s + (v.dias_corridos ?? 0), 0) / abertasComSla.length)
      : 0

    setKpis({ abertas, fechadas, congeladas, slaM, atrasadas })

    const rs = [...new Set(all.map(v => v.recrutador).filter(Boolean))] as string[]
    setRecrutas(rs)

    setLoading(false)
  }, [statusFiltro, unitFiltro, recrutFiltro, search, sb])

  useEffect(() => { load() }, [load])

  async function loadLogs(id: string) {
    const { data } = await sb
      .from('job_opening_logs')
      .select('*')
      .eq('opening_id', id)
      .order('created_at', { ascending: false })
    setLogs((data ?? []) as LogEntry[])
  }

  function selectVaga(v: Vaga) {
    setVagaSel(v)
    setNovoLog('')
    loadLogs(v.id)
  }

  async function addLog() {
    if (!vagaSel || !novoLog.trim()) return
    setSaving(true)
    await sb.from('job_opening_logs').insert({
      opening_id: vagaSel.id,
      texto: novoLog.trim(),
      autor: 'Usuário',
    })
    setNovoLog('')
    loadLogs(vagaSel.id)
    setSaving(false)
  }

  async function atualizarStatus(id: string, status: StatusVaga) {
    await sb.from('job_openings').update({ status }).eq('id', id)
    load()
    if (vagaSel?.id === id) setVagaSel(prev => prev ? { ...prev, status } : null)
  }

  // ── Importador Excel ───────────────────────────────────────────────────────
  async function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportLog(['🔄 Lendo arquivo…'])

    try {
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array', cellDates: true })
      const log: string[] = ['🔄 Lendo arquivo…']

      const wsName = wb.SheetNames.find(n =>
        n.toUpperCase().includes('VAG') ||
        n.toUpperCase().includes('CONT') ||
        n.toUpperCase().includes('PIPELINE')
      ) ?? wb.SheetNames[0]!

      const ws   = wb.Sheets[wsName]!
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
      log.push(`📋 Aba "${wsName}" · ${rows.length} linhas`)
      setImportLog([...log])

      const HEADER_KEYWORDS = ['UNIDADE','CARGO','STATUS','SOLICIT','RECRUT']
      let headerRow = -1
      for (let i = 0; i < Math.min(15, rows.length); i++) {
        const r = (rows[i] as (string | null)[]).map(c => String(c ?? '').toUpperCase())
        if (HEADER_KEYWORDS.filter(k => r.some(c => c.includes(k))).length >= 3) {
          headerRow = i; break
        }
      }
      if (headerRow < 0) throw new Error('Cabeçalho de vagas não reconhecido. Verifique as colunas.')

      const headers = (rows[headerRow] as (string | null)[]).map(c => String(c ?? '').trim().toUpperCase())
      log.push(`📌 Cabeçalho linha ${headerRow + 1}: ${headers.slice(0, 8).join(' | ')} …`)
      setImportLog([...log])

      const col = (kw: string[]) => headers.findIndex(h => kw.some(k => h.includes(k)))
      const C = {
        unidade:  col(['UNIDADE','UNIT']),
        depto:    col(['DEPTO','DEPARTAMENT']),
        motivo:   col(['MOTIVO']),
        solicit:  col(['SOLICIT','DATA SOL']),
        sla:      col(['SLA']),
        fechPrev: col(['FECHAMENTO','PREV']),
        recrut:   col(['RECRUT']),
        status:   col(['STATUS GERAL','STATUS']),
        cargo:    col(['CARGO']),
        horario:  col(['HORÁRIO','HORARIO']),
        salario:  col(['SALÁRIO','SALARIO','REMUNER']),
        aprovado: col(['APROVADO','CANDIDATO APR']),
        admissao: col(['ADMISSÃO','ADMISSAO','DATA ADM']),
        fonte:    col(['FONTE']),
      }

      const { data: unitData } = await sb.from('units').select('id,name')
      const unitMap: Record<string, string> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const u of unitData ?? [] as any[]) {
        unitMap[u.name.toLowerCase()] = u.id
        unitMap[u.name.toLowerCase().replace(/[^a-z0-9]/g, '')] = u.id
      }

      const MOTIVO_MAP: Record<string, MotivoVaga> = {
        'substituição':  'substituicao_desligamento',
        'substitui':     'substituicao_desligamento',
        'desligamento':  'substituicao_desligamento',
        'aumento':       'aumento_hc',
        'abertura':      'abertura_casa',
        'adequação':     'adequacao_hc',
        'adequacao':     'adequacao_hc',
      }

      const STATUS_MAP: Record<string, StatusVaga> = {
        aberta: 'aberta', fechada: 'fechada', congelada: 'congelada',
        open: 'aberta', closed: 'fechada',
      }

      const parseDate = (v: unknown): string | null => {
        if (!v) return null
        if (v instanceof Date) return v.toISOString().slice(0, 10)
        const num = Number(v)
        if (!isNaN(num) && num > 40000) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = (XLSX.SSF as any).parse_date_code(num) as { y: number; m: number; d: number }
          return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
        }
        const s = String(v).trim()
        const parts = s.split(/[/\-]/)
        if (parts.length === 3) {
          const [p0, p1, p2] = [parts[0]!, parts[1]!, parts[2]!]
          if (p2.length === 4) return `${p2}-${p1.padStart(2, '0')}-${p0.padStart(2, '0')}`
          if (p0.length === 4) return `${p0}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`
        }
        return null
      }

      let skipped = 0
      const errs: string[] = []
      const toInsert: Record<string, unknown>[] = []

      for (let i = headerRow + 1; i < rows.length; i++) {
        const r = rows[i] as (string | number | Date | null)[]
        const cargo = String(r[C.cargo] ?? '').trim()
        if (!cargo) { skipped++; continue }

        const unidadeRaw = String(r[C.unidade] ?? '').trim()
        const unitId = unitMap[unidadeRaw.toLowerCase()] ??
                       unitMap[unidadeRaw.toLowerCase().replace(/[^a-z0-9]/g, '')] ??
                       null

        if (!unitId) {
          errs.push(`Linha ${i + 1}: unidade "${unidadeRaw}" não encontrada`)
          skipped++
          continue
        }

        const statusRaw = String(r[C.status] ?? 'aberta').trim().toLowerCase()
        const status: StatusVaga = STATUS_MAP[statusRaw] ?? 'aberta'

        const motivoRaw = String(r[C.motivo] ?? '').trim().toLowerCase()
        const motivoKey = Object.keys(MOTIVO_MAP).find(k => motivoRaw.includes(k))
        const motivo: MotivoVaga | null = motivoKey ? (MOTIVO_MAP[motivoKey] ?? null) : null

        const salarioRaw = r[C.salario]
        const salario = salarioRaw
          ? Number(String(salarioRaw).replace(/[R$\s.]/g, '').replace(',', '.'))
          : null

        toInsert.push({
          unit_id:             unitId,
          title:               cargo,
          department:          C.depto >= 0 ? String(r[C.depto] ?? '').trim() || null : null,
          status,
          motivo:              motivo ?? null,
          recrutador:          C.recrut   >= 0 ? String(r[C.recrut]   ?? '').trim() || null : null,
          sla_dias:            C.sla      >= 0 ? Number(r[C.sla]) || null : null,
          horario:             C.horario  >= 0 ? String(r[C.horario]  ?? '').trim() || null : null,
          salario:             salario && !isNaN(salario) ? salario : null,
          fonte_recrutamento:  C.fonte    >= 0 ? String(r[C.fonte]    ?? '').trim() || null : null,
          candidato_aprovado:  C.aprovado >= 0 ? String(r[C.aprovado] ?? '').trim() || null : null,
          data_admissao:       C.admissao >= 0 ? parseDate(r[C.admissao]) : null,
          fechamento_previsto: C.fechPrev >= 0 ? parseDate(r[C.fechPrev]) : null,
          created_at:          C.solicit  >= 0 && parseDate(r[C.solicit])
                                 ? parseDate(r[C.solicit])
                                 : new Date().toISOString(),
        })
      }

      log.push(`📦 ${toInsert.length} vagas para inserir · ${skipped} linhas ignoradas`)
      if (errs.length) log.push(`⚠️  ${errs.length} erros: ${errs.slice(0, 3).join(' | ')}`)
      setImportLog([...log])

      if (!toInsert.length) throw new Error('Nenhuma vaga válida encontrada na planilha.')

      const BATCH = 100
      let count = 0
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const { data: ins, error: insErr } = await sb
          .from('job_openings')
          .insert(toInsert.slice(i, i + BATCH))
          .select('id')
        if (insErr) throw new Error(`Batch ${Math.ceil(i / BATCH) + 1}: ${insErr.message}`)
        count += ins?.length ?? 0
        log.push(`💾 Batch ${Math.ceil(i / BATCH) + 1}: ${ins?.length} registros salvos`)
        setImportLog([...log])
      }

      log.push(`🎉 Importação concluída — ${count} vagas importadas!`)
      setImportLog([...log])
      load()
      setTab('pipeline')
    } catch (err: unknown) {
      setImportLog(prev => [...prev, `❌ Erro: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-64px)]">

      {/* Painel principal */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Controle de Vagas</h1>
              <p className="text-sm text-gray-500 mt-0.5">Pipeline R&amp;S · SLA automático · histórico completo</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTab(tab === 'importar' ? 'pipeline' : 'importar')}
                className="text-sm border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 rounded-lg transition"
              >
                📥 {tab === 'importar' ? 'Voltar ao Pipeline' : 'Importar Excel'}
              </button>
            </div>
          </div>

          {/* KPIs */}
          {kpis && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Abertas',    value: kpis.abertas,    color: 'text-blue-600',   bg: 'bg-blue-50'   },
                { label: 'Fechadas',   value: kpis.fechadas,   color: 'text-green-600',  bg: 'bg-green-50'  },
                { label: 'Congeladas', value: kpis.congeladas, color: 'text-gray-500',   bg: 'bg-gray-50'   },
                { label: 'SLA Médio',  value: `${kpis.slaM}d`, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Atrasadas',  value: kpis.atrasadas,  color: 'text-red-600',    bg: 'bg-red-50'    },
              ].map(k => (
                <div key={k.label} className={`${k.bg} rounded-xl border border-white px-4 py-3`}>
                  <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Tab Pipeline ── */}
          {tab === 'pipeline' && (
            <>
              {/* Filtros */}
              <div className="flex flex-wrap gap-2">
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                  {(['todos','aberta','fechada','congelada'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFiltro(s)}
                      className={`px-3 py-1.5 capitalize transition ${
                        statusFiltro === s
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {s === 'todos' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>

                <select
                  value={unitFiltro}
                  onChange={e => setUnitFiltro(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {!units.length && <option value="todos" disabled>Carregando…</option>}
                <option value="todos">Todas as unidades</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>

                {recrutas.length > 0 && (
                  <select
                    value={recrutFiltro}
                    onChange={e => setRecrutFiltro(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="todos">Todos os recrutadores</option>
                    {recrutas.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}

                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar cargo ou candidato…"
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-w-48"
                />
              </div>

              {/* Tabela */}
              {loading ? (
                <div className="text-center py-12 text-gray-400 text-sm">Carregando…</div>
              ) : !vagas.length ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  Nenhuma vaga encontrada.
                  <button onClick={() => setTab('importar')} className="ml-2 text-indigo-600 hover:underline">
                    Importar histórico →
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                  <div style={{ overflowX: "auto" }}>
                  <table className="w-full text-sm" style={{ minWidth: 700 }}>
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Cargo','Unidade','Status','Prazo SLA','Dias aberta','Recrutador','Candidato','Ações'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {vagas.map(v => {
                        const sp = v.status_prazo ?? 'no_prazo'
                        const badge = SLA_BADGE[sp]
                        return (
                          <tr
                            key={v.id}
                            onClick={() => selectVaga(v)}
                            className={`cursor-pointer transition hover:bg-indigo-50/40 ${vagaSel?.id === v.id ? 'bg-indigo-50' : ''}`}
                          >
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {v.title}
                              {v.motivo && (
                                <p className="text-xs text-gray-400 font-normal mt-0.5">{MOTIVO_LABEL[v.motivo]}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {v.unit_name}
                              {v.department && <p className="text-xs text-gray-400">{v.department}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                v.status === 'aberta'    ? 'bg-blue-50 text-blue-700'   :
                                v.status === 'fechada'   ? 'bg-green-50 text-green-700' :
                                                           'bg-gray-100 text-gray-500'
                              }`}>
                                {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>
                                {badge.label}{v.sla_dias ? ` · ${v.sla_dias}d` : ''}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-bold ${(v.dias_corridos ?? 0) > (v.sla_dias ?? 999) ? 'text-red-600' : 'text-gray-700'}`}>
                                {diasLabel(v.dias_corridos)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{v.recrutador ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {v.candidato_aprovado
                                ? <span className="text-green-700 font-medium">✓ {v.candidato_aprovado}</span>
                                : <span className="text-gray-400">—</span>
                              }
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={v.status}
                                onChange={e => { e.stopPropagation(); atualizarStatus(v.id, e.target.value as StatusVaga) }}
                                onClick={e => e.stopPropagation()}
                                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none"
                              >
                                <option value="aberta">Aberta</option>
                                <option value="fechada">Fechada</option>
                                <option value="congelada">Congelada</option>
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </div>
                  <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
                    {vagas.length} vaga{vagas.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Tab Importar ── */}
          {tab === 'importar' && (
            <div className="space-y-6 max-w-2xl">
              <div
                onClick={() => !importing && fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  importing
                    ? 'border-indigo-300 bg-indigo-50 cursor-not-allowed'
                    : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
                }`}
              >
                <div className="text-4xl mb-3">{importing ? '⏳' : '📂'}</div>
                <p className="text-sm font-medium text-gray-700">
                  {importing ? 'Processando…' : 'Clique para selecionar o Controle de Vagas (.xlsx)'}
                </p>
                <p className="text-xs text-gray-400 mt-1">Histórico 2024–2026 · todas as unidades</p>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcel} />

              {importLog.length > 0 && (
                <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
                  {importLog.map((l, i) => (
                    <p key={i} className={
                      l.startsWith('❌')  ? 'text-red-400'          :
                      l.startsWith('✅') || l.startsWith('💾') ? 'text-green-400' :
                      l.startsWith('🎉')  ? 'text-yellow-300 font-bold' :
                      l.startsWith('⚠️') ? 'text-yellow-400'       :
                      'text-gray-300'
                    }>{l}</p>
                  ))}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-800 mb-2">📋 Colunas esperadas na planilha</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-amber-700">
                  {[
                    ['Unidade',            'Nome da unidade (ex: Unidade)'],
                    ['Cargo',              'Título da vaga'],
                    ['Status Geral',       'Aberta / Fechada / Congelada'],
                    ['Motivo',             'Substituição / Aumento HC / …'],
                    ['Data Solicitação',   'DD/MM/AAAA'],
                    ['SLA',                'Número de dias'],
                    ['Recrutador',         'Nome do recrutador'],
                    ['Candidato Aprovado', 'Nome (se fechada)'],
                    ['Data Admissão',      'DD/MM/AAAA'],
                    ['Salário',            'Valor numérico'],
                  ].map(([col, desc]) => (
                    <div key={col} className="flex gap-1">
                      <span className="font-semibold">{col}:</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Painel lateral: detalhe da vaga */}
      {vagaSel && (
        <div className="w-96 border-l border-gray-100 bg-white flex flex-col overflow-hidden shadow-lg">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-start">
            <div>
              <p className="font-semibold text-gray-900">{vagaSel.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{vagaSel.unit_name} · {vagaSel.department ?? 'Geral'}</p>
            </div>
            <button onClick={() => setVagaSel(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>

          <div className="px-5 py-4 space-y-3 border-b border-gray-100">
            {([
              ['Status',      vagaSel.status],
              ['Motivo',      vagaSel.motivo ? MOTIVO_LABEL[vagaSel.motivo] : '—'],
              ['Recrutador',  vagaSel.recrutador ?? '—'],
              ['SLA',         vagaSel.sla_dias ? `${vagaSel.sla_dias} dias` : '—'],
              ['Dias aberta', diasLabel(vagaSel.dias_corridos)],
              ['Salário',     fmt(vagaSel.salario)],
              ['Horário',     vagaSel.horario ?? '—'],
              ['Fonte',       vagaSel.fonte_recrutamento ?? '—'],
              ['Aprovado',    vagaSel.candidato_aprovado ?? '—'],
              ['Admissão',    vagaSel.data_admissao
                ? new Date(vagaSel.data_admissao + 'T12:00:00').toLocaleDateString('pt-BR') : '—'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-400">{k}</span>
                <span className="text-gray-800 font-medium text-right max-w-[60%]">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Movimentações</p>
            {logs.length === 0 && <p className="text-xs text-gray-400">Nenhuma movimentação registrada.</p>}
            {logs.map(l => (
              <div key={l.id} className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-700">{l.texto}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {l.autor} · {new Date(l.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-gray-100">
            <textarea
              value={novoLog}
              onChange={e => setNovoLog(e.target.value)}
              placeholder="Ex: ERICK enviado para teste 18/03 — aprovado em entrevista…"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <button
              onClick={addLog}
              disabled={saving || !novoLog.trim()}
              className="mt-2 w-full text-sm bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-40"
            >
              {saving ? 'Salvando…' : 'Registrar movimentação'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
