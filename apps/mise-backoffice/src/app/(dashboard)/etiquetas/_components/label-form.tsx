'use client'

import { useState, useEffect, useRef } from 'react'
import { Printer, AlertTriangle, CheckCircle, Bluetooth, Minus, Plus, Package, ChefHat } from 'lucide-react'
import { buildTSPL, tsplToBase64 } from '@/lib/etiqueta-tspl'
import { DatePicker } from '@/components/ui/date-picker'
import { MiseMark } from '@/components/layout/topnav'

type Ingredient = { id: string; nome: string; categoria_anvisa: string | null }
type MenuItem = { id: string; nome: string }
type Responsavel = { id: string; nome: string; unit_ids: string[] }
type Unit = { id: string; name: string; cnpj?: string | null; address?: string | null }
type PrintPoint = { id: string; name: string; icone: string | null }

const CATEGORIA_ANVISA_OPTIONS = [
  { value: 'proteina_animal_cozida', label: 'Proteína Animal Cozida' },
  { value: 'proteina_animal_crua', label: 'Proteína Animal Crua' },
  { value: 'pescado_cru', label: 'Pescado Cru' },
  { value: 'pescado_cozido', label: 'Pescado Cozido' },
  { value: 'vegetal_cozido', label: 'Vegetal Cozido' },
  { value: 'vegetal_cru', label: 'Vegetal Cru' },
  { value: 'arroz_massa_cereais', label: 'Arroz / Massa / Cereais' },
  { value: 'molho_caldo', label: 'Molho / Caldo' },
  { value: 'laticinios', label: 'Laticínios' },
  { value: 'sobremesa', label: 'Sobremesa' },
  { value: 'fritura', label: 'Fritura' },
]

const METODOS = [
  'Resfriado 0-5°C',
  'Refrigerado 5-10°C',
  'Congelado -18°C',
  'Temperatura ambiente',
]

const SELOS = ['Nenhum', 'SIF', 'SISP', 'SIM'] as const

const SETORES = [
  'Cozinha Produção',
  'Cozinha Garde',
  'Cozinha Fogão',
  'Confeitaria',
  'Parrilha',
  'Bar 1',
  'Bar 2',
  'Bar 3',
  'Salão 1',
  'Salão 2',
  'Salão 3',
  'Câmara Refrigerada',
  'Câmara Congelada',
] as const

const AVATAR_COLORS = [
  'bg-fresh', 'bg-info', 'bg-purple-600', 'bg-orange-600',
  'bg-alert', 'bg-cyan-600', 'bg-pink-600', 'bg-yellow-600',
]

function getColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function getInitials(nome: string) {
  const p = nome.trim().split(' ')
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function nowLocalISO(): string {
  const sp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${sp.getFullYear()}-${p(sp.getMonth() + 1)}-${p(sp.getDate())}T${p(sp.getHours())}:${p(sp.getMinutes())}`
}

export function LabelForm({
  ingredients,
  menuItems,
  responsaveis,
  units,
}: {
  ingredients: Ingredient[]
  menuItems: MenuItem[]
  responsaveis: Responsavel[]
  units: Unit[]
}) {
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; nome: string; tipo: 'ingrediente' | 'preparacao'; categoria_anvisa?: string | null } | null>(null)
  const [tipo, setTipo] = useState<'ingrediente' | 'preparacao' | 'porcao'>('ingrediente')
  const [categoria, setCategoria] = useState('')
  const [categoriaFromCadastro, setCategoriaFromCadastro] = useState(false)
  const [pesoKg, setPesoKg] = useState('')
  const [selectedResponsavel, setSelectedResponsavel] = useState<string>('')
  const [empSearch, setEmpSearch] = useState('')
  const [selectedUnit, setSelectedUnit] = useState<string>('')
  const [setor, setSetor] = useState('')
  const [lote, setLote] = useState('')
  const [selo, setSelo] = useState<'Nenhum' | 'SIF' | 'SISP' | 'SIM'>('Nenhum')
  const [validadeFornecedor, setValidadeFornecedor] = useState('')
  const [metodo, setMetodo] = useState('')
  const [dataManipulacao, setDataManipulacao] = useState(nowLocalISO())
  const [validade, setValidade] = useState('')
  const [validadeReadonly, setValidadeReadonly] = useState(false)
  const [prazoHoras, setPrazoHoras] = useState<number | null>(null)
  const [shelfLifeSource, setShelfLifeSource] = useState<'custom' | 'anvisa' | null>(null)
  const [printPoints, setPrintPoints] = useState<PrintPoint[]>([])
  const [printPointId, setPrintPointId] = useState('')
  const [savedLabel, setSavedLabel] = useState<{ id: string; nome: string; unit?: Unit } | null>(null)
  const [quantidade, setQuantidade] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [conflictLabel, setConflictLabel] = useState<{ id: string; nome: string; data_manipulacao: string; validade: string; responsavel_nome: string } | null>(null)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [conflictResolution, setConflictResolution] = useState<'none' | 'overwrite' | 'keep'>('none')
  const productSearchRef = useRef<HTMLInputElement>(null)

  // A changed draft must be saved again before its print actions are offered.
  useEffect(() => {
    setSavedLabel(null)
  }, [selectedProduct, selectedUnit, selectedResponsavel, metodo, dataManipulacao, validade, lote, setor, selo, pesoKg, validadeFornecedor, printPointId])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        productSearchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  const searchResults = search.length >= 2
    ? [
        ...ingredients.filter(i => i.nome.toLowerCase().includes(search.toLowerCase())).map(i => ({ ...i, tipo: 'ingrediente' as const })),
        ...menuItems.filter(m => m.nome.toLowerCase().includes(search.toLowerCase())).map(m => ({ id: m.id, nome: m.nome, tipo: 'preparacao' as const, categoria_anvisa: null })),
      ].slice(0, 8)
    : []

  const unitResponsaveis = selectedUnit
    ? responsaveis.filter(r => r.unit_ids.includes(selectedUnit))
    : []

  const filteredResponsaveis = empSearch
    ? unitResponsaveis.filter(r => r.nome.toLowerCase().includes(empSearch.toLowerCase()))
    : unitResponsaveis

  const selectedResponsavelNome = responsaveis.find(r => r.id === selectedResponsavel)?.nome ?? ''

  useEffect(() => {
    if (!selectedProduct || !selectedUnit) return
    const ingredientId = selectedProduct.tipo === 'ingrediente' ? selectedProduct.id : undefined
    if (!ingredientId) return
    let cancelled = false
    fetch(`/api/labels/check-conflict?ingredient_id=${ingredientId}&unit_id=${selectedUnit}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data.conflict) {
          setConflictLabel(data.conflict)
          setShowConflictModal(true)
          setConflictResolution('none')
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedProduct, selectedUnit])

  useEffect(() => {
    if (!metodo) {
      setValidadeReadonly(false)
      setPrazoHoras(null)
      setShelfLifeSource(null)
      return
    }

    const ingredientId = selectedProduct?.tipo === 'ingrediente' ? selectedProduct.id : null

    // Precisa de pelo menos ingredient_id ou categoria para buscar
    if (!ingredientId && !categoria) {
      setValidadeReadonly(false)
      setPrazoHoras(null)
      setShelfLifeSource(null)
      return
    }

    let cancelled = false
    const params = new URLSearchParams({ metodo })
    if (ingredientId) params.set('ingredient_id', ingredientId)
    if (categoria) params.set('categoria', categoria)

    fetch(`/api/shelf-life-rule?${params}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.prazo_horas) {
          setPrazoHoras(data.prazo_horas)
          setValidadeReadonly(true)
          setShelfLifeSource(data.source ?? null)
        } else {
          setPrazoHoras(null)
          setValidadeReadonly(false)
          setShelfLifeSource(null)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [categoria, metodo, selectedProduct])

  useEffect(() => {
    if (!prazoHoras || !dataManipulacao) return
    const base = new Date(dataManipulacao)
    base.setHours(base.getHours() + prazoHoras)
    const p = (n: number) => String(n).padStart(2, '0')
    setValidade(`${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())}T${p(base.getHours())}:${p(base.getMinutes())}`)
  }, [prazoHoras, dataManipulacao])

  useEffect(() => {
    if (!selectedUnit) { setPrintPoints([]); setPrintPointId(''); return }
    fetch(`/api/print-points?unit_id=${selectedUnit}`)
      .then(r => r.json())
      .then(data => { setPrintPoints(data.print_points ?? []); setPrintPointId('') })
      .catch(() => {})
  }, [selectedUnit])

  function handleSelectProduct(p: { id: string; nome: string; tipo: 'ingrediente' | 'preparacao'; categoria_anvisa?: string | null }) {
    setSelectedProduct(p)
    setSearch(p.nome)
    setTipo(p.tipo === 'ingrediente' ? 'ingrediente' : 'preparacao')
    setCategoria('')
    setCategoriaFromCadastro(false)
    setPrazoHoras(null)
    setValidadeReadonly(false)
    setShelfLifeSource(null)
    setValidade('')
    if (p.tipo === 'ingrediente' && p.categoria_anvisa) {
      setCategoria(p.categoria_anvisa)
      setCategoriaFromCadastro(true)
    }
    setConflictLabel(null)
    setConflictResolution('none')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProduct || !selectedUnit || !dataManipulacao || !validade) return
    if (conflictLabel && conflictResolution === 'none') {
      setShowConflictModal(true)
      return
    }

    setSaving(true)
    setError('')

    if (conflictLabel && conflictResolution === 'overwrite') {
      await fetch(`/api/labels/${conflictLabel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'descartada' }),
      })
    }

    const payload = {
      unit_id: selectedUnit,
      responsavel_id: selectedResponsavel || null,
      responsavel_nome: selectedResponsavelNome || null,
      ingredient_id: selectedProduct.tipo === 'ingrediente' ? selectedProduct.id : null,
      menu_item_id: selectedProduct.tipo === 'preparacao' ? selectedProduct.id : null,
      tipo,
      nome: selectedProduct.nome,
      peso_kg: pesoKg ? Number(pesoKg) : null,
      setor: setor || null,
      lote: lote || null,
      selo: selo !== 'Nenhum' ? selo : null,
      validade_fornecedor: validadeFornecedor || null,
      metodo_conservacao: metodo || null,
      data_manipulacao: new Date(dataManipulacao).toISOString(),
      validade: new Date(validade).toISOString(),
      print_point_id: printPointId || null,
      status: 'ativa',
    }

    const res = await fetch('/api/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erro ao salvar etiqueta.')
      setSaving(false)
      return
    }

    const { id } = await res.json()
    const unitObj = units.find(u => u.id === selectedUnit)
    setSavedLabel({ id, nome: selectedProduct.nome, unit: unitObj })
    setSaving(false)
  }

  function handlePrint() {
    if (!savedLabel) return
    const fmtDate = (v: string) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit' })
    const respNome = selectedResponsavelNome.split(' ')[0]
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Etiqueta</title>
<style>@page{size:60mm 60mm;margin:0}
html,body{margin:0;padding:0;width:60mm;height:60mm;overflow:hidden;font-family:monospace}
.label{width:60mm;height:60mm;padding:4mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;background:#fff;color:#000;overflow:hidden;page-break-inside:avoid;page-break-after:avoid}
.nome{font-size:13pt;font-weight:bold;line-height:1.1}
.metodo{font-size:8pt;line-height:1.2;margin-top:0.5mm;text-transform:uppercase}
.dates{border-top:1px solid #000;border-bottom:1px solid #000;padding:3mm 0;margin:3mm 0}
.row{display:flex;justify-content:space-between;align-items:baseline;font-size:9.5pt;line-height:1.4}
.row .lbl{font-weight:bold}
.row .validade-valor{font-size:15pt;font-weight:bold}
.resp{font-size:9pt}
.resp b{font-weight:bold}
.id{font-size:7pt}
</style></head><body>
<div class="label">
  <div>
    <div class="nome">${savedLabel.nome}</div>
    ${metodo ? `<div class="metodo">${metodo}</div>` : ''}
  </div>
  <div class="dates">
    <div class="row"><span class="lbl">MANIPULAÇÃO:</span><span>${fmtDate(dataManipulacao)}</span></div>
    <div class="row"><span class="lbl">VALIDADE:</span><span class="validade-valor">${fmtDate(validade)}</span></div>
  </div>
  <div class="resp"><b>RESP.:</b> ${respNome}</div>
  <div class="id">#${savedLabel.id.slice(0, 6).toUpperCase()}</div>
</div>
</body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 250)
  }

  // Envia os comandos TSPL crus para o app dedicado MISE Print via deep link,
  // que escreve os bytes diretamente no socket Bluetooth SPP da impressora.
  function handlePrintBluetooth() {
    if (!savedLabel) return
    const respNome = selectedResponsavelNome.split(' ')[0]
    const tspl = buildTSPL({
      nome: savedLabel.nome,
      metodo,
      dataManipulacao,
      validade,
      respNome,
      id: savedLabel.id,
      quantidade,
    })
    const b64 = tsplToBase64(tspl)
    const url = `miseprint://print?data=${encodeURIComponent(b64)}`
    window.location.href = url
  }

  return (
    <div className="production-label-form rounded-xl border border-edge bg-surface">
      <div className="production-form-heading border-b border-edge px-5 py-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Printer size={17} className="text-ink-muted" /> Mise Label Studio</p>
      </div>

      {(ingredients.length > 0 || menuItems.length > 0) && <div className="production-quick-products">
        <div><h2>O que vamos preparar?</h2><span>Selecione um preparo ou busque no catálogo abaixo.</span></div>
        <div className="quick-product-grid">
          {[
            ...ingredients.slice(0, 3).map(p => ({ ...p, tipo: 'ingrediente' as const })),
            ...menuItems.slice(0, 3).map(p => ({ ...p, tipo: 'preparacao' as const, categoria_anvisa: null })),
          ].map(product => <button key={`${product.tipo}-${product.id}`} type="button" aria-pressed={selectedProduct?.id === product.id && selectedProduct?.tipo === product.tipo} className={selectedProduct?.id === product.id && selectedProduct?.tipo === product.tipo ? 'selected' : ''} onClick={() => handleSelectProduct(product)}>
            <span>{product.tipo === 'ingrediente' ? <Package size={20} /> : <ChefHat size={20} />}</span><strong>{product.nome}</strong><small>{product.tipo === 'ingrediente' ? 'Ingrediente' : 'Preparo da casa'}</small>
          </button>)}
        </div>
      </div>}

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Produto */}
          <div className="relative">
            <label className="block text-xs font-medium text-ink-muted mb-1">Produto *</label>
            <input
              ref={productSearchRef}
              value={search}
              onChange={e => { setSearch(e.target.value); setActiveIndex(-1); if (!e.target.value) setSelectedProduct(null) }}
              onKeyDown={e => {
                if (!searchResults.length || selectedProduct) return
                if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => (i + 1) % searchResults.length) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => (i - 1 + searchResults.length) % searchResults.length) }
                else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); handleSelectProduct(searchResults[activeIndex]) }
                else if (e.key === 'Escape') { setSearch(''); setActiveIndex(-1); setSelectedProduct(null) }
              }}
              placeholder="Buscar produto (mín. 2 letras)"
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ink-subtle focus:outline-none"
            />
            {searchResults.length > 0 && !selectedProduct && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-edge-strong bg-surface shadow-lg">
                {searchResults.map((r, i) => (
                  <button key={r.id} type="button"
                    onClick={() => handleSelectProduct(r)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-sm text-ink transition-colors ${i === activeIndex ? 'bg-surface-raised' : 'hover:bg-surface-raised'}`}>
                    <span>{r.nome}</span>
                    <span className="text-xs text-ink-subtle capitalize">{r.tipo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Unidade */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Unidade *</label>
            <select value={selectedUnit} onChange={e => { setSelectedUnit(e.target.value); setSelectedResponsavel('') }} required
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
              <option value="">Selecionar unidade</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

        </div>

        {/* Categoria ANVISA — fora da grid para não deslocar os campos abaixo ao aparecer/sumir */}
        {selectedProduct && shelfLifeSource !== 'custom' && (
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Categoria ANVISA</label>
            {categoriaFromCadastro ? (
              <div className="flex items-center gap-2 rounded-lg border border-fresh/40 bg-fresh-soft px-3 py-2">
                <CheckCircle className="h-4 w-4 text-fresh-bright shrink-0" />
                <span className="text-sm text-fresh-bright">
                  {CATEGORIA_ANVISA_OPTIONS.find(o => o.value === categoria)?.label ?? categoria}
                </span>
                <span className="ml-auto text-xs text-fresh">Do cadastro do produto</span>
              </div>
            ) : (
              <>
                <select value={categoria} onChange={e => setCategoria(e.target.value)}
                  className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
                  <option value="">Selecionar categoria</option>
                  {CATEGORIA_ANVISA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {selectedProduct.tipo === 'ingrediente' && !categoria && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-warn">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Sem categoria — <a href={`/cadastros/produtos/${selectedProduct.id}`} className="underline">preencher no cadastro</a></span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Método de conservação */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Método de conservação</label>
            <select value={metodo} onChange={e => setMetodo(e.target.value)}
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
              <option value="">Selecionar método</option>
              {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Peso */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Peso (kg)</label>
            <input type="number" value={pesoKg} onChange={e => setPesoKg(e.target.value)} min="0.010" step="0.001"
              placeholder="ex: 0.300"
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
          </div>

          {/* Setor */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Setor</label>
            <select value={setor} onChange={e => setSetor(e.target.value)}
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
              <option value="">Selecionar setor</option>
              {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Lote */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Lote</label>
            <input value={lote} onChange={e => setLote(e.target.value)} placeholder="ex: L2024001"
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
          </div>

          {/* Validade fornecedor */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Validade original (fornecedor)</label>
            <DatePicker value={validadeFornecedor} onChange={setValidadeFornecedor} placeholder="dd/mm/aaaa" />
          </div>

          {/* Data manipulação */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Data de manipulação *</label>
            <DatePicker value={dataManipulacao} onChange={setDataManipulacao} withTime placeholder="Selecionar data e hora" />
          </div>

          {/* Validade */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Validade *</label>
            {validadeReadonly ? (
              <div className="flex items-center gap-2 rounded-lg border border-fresh/40 bg-fresh-soft px-3 py-2">
                <CheckCircle className="h-4 w-4 text-fresh-bright shrink-0" />
                <span className="text-sm text-fresh-bright">
                  {validade ? new Date(validade).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
                <span className="ml-auto text-xs text-fresh">
                  {shelfLifeSource === 'custom' ? `Suflex · ${prazoHoras}h` : `ANVISA · ${prazoHoras}h`}
                </span>
              </div>
            ) : (
              <DatePicker value={validade} onChange={setValidade} withTime placeholder="Selecionar data e hora" />
            )}
          </div>
        </div>

        {/* Selo */}
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-2">Selo de inspeção</label>
          <div className="flex gap-2">
            {SELOS.map(s => (
              <button key={s} type="button" onClick={() => setSelo(s)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selo === s ? 'border-ember bg-ember text-ember-ink' : 'border-edge-strong text-ink-muted hover:text-ink'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Responsável */}
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-2">Responsável</label>
          {!selectedUnit ? (
            <p className="text-sm text-ink-subtle">Selecione uma unidade para ver os responsáveis.</p>
          ) : unitResponsaveis.length === 0 ? (
            <p className="text-sm text-ink-subtle">
              Nenhum responsável cadastrado para esta unidade. Cadastre em{' '}
              <a href="/cadastros/responsaveis" className="underline">Cadastros → Responsáveis</a>.
            </p>
          ) : (
            <>
              {unitResponsaveis.length > 6 && (
                <input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="Buscar responsável"
                  className="mb-2 w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {filteredResponsaveis.map(r => (
                  <button key={r.id} type="button" onClick={() => setSelectedResponsavel(r.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors min-h-[80px] ${
                      selectedResponsavel === r.id ? 'border-ember bg-ember-soft' : 'border-edge bg-surface-raised/50 hover:border-edge-strong'
                    }`}>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${getColor(r.id)}`}>
                      {getInitials(r.nome)}
                    </div>
                    <span className="text-xs text-ink-muted leading-tight">{r.nome.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Ponto de impressão */}
        {printPoints.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Ponto de impressão</label>
            <select value={printPointId} onChange={e => setPrintPointId(e.target.value)}
              className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
              <option value="">Sem ponto de impressão</option>
              {printPoints.map(p => <option key={p.id} value={p.id}>{p.icone ? `${p.icone} ` : ''}{p.name}</option>)}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-alert-bright">{error}</p>}

        {conflictLabel && conflictResolution === 'none' && (
          <div className="rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn-bright">
            <AlertTriangle className="mb-1 h-4 w-4" />
            Etiqueta ativa para este produto nesta unidade.{' '}
            <a href="/validades" className="underline">Ver detalhes</a>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !selectedProduct || !selectedUnit || (selectedProduct?.tipo === 'ingrediente' && !categoria && shelfLifeSource !== 'custom')}
          className="rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-40 transition-colors"
        >
          {saving ? 'Salvando...' : 'Gerar Etiqueta'}
        </button>
      </form>

      <aside className="production-live-preview" aria-label="Prévia da etiqueta">
        <div>
          <h2>Sua próxima etiqueta</h2>
          <div className="thermal-stage">
            <div className="printer-slot" />
            <div className="thermal-label">
              <div className="thermal-header"><MiseMark /><span>CONTROLE DE PREPARO</span></div>
              <div className="thermal-product"><h3>{selectedProduct?.nome || 'Seu próximo preparo'}</h3><span>{metodo || 'SELECIONE A CONSERVAÇÃO'}</span></div>
              <div className="thermal-dates">
                <div><span>PREPARADO EM</span><strong>{dataManipulacao ? new Date(dataManipulacao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'}</strong></div>
                <div className="expiry-date"><span>VÁLIDO ATÉ</span><strong>{validade ? new Date(validade).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'}</strong></div>
              </div>
              <div className="thermal-bottom"><div><span>RESPONSÁVEL <strong>{selectedResponsavelNome || 'A selecionar'}</strong></span><span>LOTE <strong>{lote || 'A definir'}</strong></span></div></div>
            </div>
            <span className="label-size">60 × 60 mm <span>·</span> Etiqueta térmica</span>
          </div>
          <p>{validadeReadonly ? `Validade calculada pela regra cadastrada: ${prazoHoras} horas. Confira os dados antes de gerar a etiqueta.` : 'Selecione o produto e a conservação. A validade será calculada quando houver uma regra cadastrada.'}</p>
        </div>
      </aside>

      {/* Conflito Modal */}
      {showConflictModal && conflictLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-edge bg-surface p-6 space-y-4">
            <h2 className="font-semibold text-ink">Etiqueta ativa encontrada</h2>
            <div className="rounded-lg border border-edge bg-base p-3 text-sm space-y-1">
              <p className="text-ink font-medium">{conflictLabel.nome}</p>
              <p className="text-ink-muted">Manipulação: {new Date(conflictLabel.data_manipulacao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
              <p className="text-ink-muted">Validade: {new Date(conflictLabel.validade).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
              <p className="text-ink-muted">Responsável: {conflictLabel.responsavel_nome}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setConflictResolution('overwrite'); setShowConflictModal(false) }}
                className="rounded-lg bg-alert px-4 py-2 text-sm font-medium text-alert-ink hover:bg-alert-bright transition-colors">
                Sobrepor (descartar a existente)
              </button>
              <button onClick={() => { setConflictResolution('keep'); setShowConflictModal(false) }}
                className="rounded-lg border border-edge-strong px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink transition-colors">
                Gerar nova (manter a existente)
              </button>
              <button onClick={() => { setShowConflictModal(false) }}
                className="text-sm text-ink-subtle hover:text-ink-muted transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {savedLabel && (
        <div className="production-saved-label border-t border-edge p-5 space-y-4">
          <p className="text-sm font-medium text-fresh-bright">Etiqueta gerada com sucesso!</p>
          <div
            style={{ width: '60mm', height: '60mm', background: '#fff', color: '#000', fontFamily: 'monospace', padding: '4mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            className="rounded border"
          >
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '13pt', lineHeight: 1.1 }}>{savedLabel.nome}</div>
              {metodo && <div style={{ fontSize: '8pt', lineHeight: 1.2, marginTop: '0.5mm', textTransform: 'uppercase' }}>{metodo}</div>}
            </div>
            <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '3mm 0', margin: '3mm 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5pt', lineHeight: 1.4 }}>
                <span style={{ fontWeight: 'bold' }}>MANIPULAÇÃO:</span>
                <span>{new Date(dataManipulacao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '9.5pt', lineHeight: 1.4 }}>
                <span style={{ fontWeight: 'bold' }}>VALIDADE:</span>
                <span style={{ fontSize: '15pt', fontWeight: 'bold' }}>{new Date(validade).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
              </div>
            </div>
            <div style={{ fontSize: '9pt' }}>
              <b>RESP.:</b> {selectedResponsavelNome.split(' ')[0]}
            </div>
            <div style={{ fontSize: '7pt' }}>#{savedLabel.id.slice(0, 6).toUpperCase()}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg border border-edge-strong px-4 py-2 text-sm text-ink-muted hover:text-ink transition-colors">
              <Printer className="h-4 w-4" />
              Imprimir Etiqueta
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-edge-strong px-1 py-1">
              <button type="button" onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised hover:text-ink transition-colors">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input type="number" min={1} value={quantidade}
                onChange={e => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
                className="w-10 bg-transparent text-center text-sm text-ink focus:outline-none" />
              <button type="button" onClick={() => setQuantidade(q => q + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised hover:text-ink transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button onClick={handlePrintBluetooth}
              className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink hover:bg-ember-hover transition-colors">
              <Bluetooth className="h-4 w-4" />
              Imprimir (Bluetooth)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
