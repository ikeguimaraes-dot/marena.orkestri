'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Group = { id: string; name: string }
type Supplier = { id: string; nome: string }

const CATEGORIAS = [
  'proteina', 'fruta', 'legume', 'verdura', 'graos',
  'laticinios', 'panificacao', 'oleo_gordura', 'tempero',
  'descartavel', 'limpeza', 'outro',
]

const CATEGORIA_ANVISA = [
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

type Initial = {
  id: string
  nome: string
  codigo: string | null
  group_id: string | null
  categoria: string
  categoria_anvisa: string | null
  unidade_padrao: string | null
  custo_padrao: number | null
  fornecedor_id: string | null
  perdas_padrao: number | null
  observacoes: string | null
  ativo: boolean
}

export function ProdutoForm({
  groups,
  suppliers,
  initial,
}: {
  groups: Group[]
  suppliers: Supplier[]
  initial?: Initial
}) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [codigo, setCodigo] = useState(initial?.codigo ?? '')
  const [groupId, setGroupId] = useState(initial?.group_id ?? '')
  const [categoria, setCategoria] = useState(initial?.categoria ?? '')
  const [categoriaAnvisa, setCategoriaAnvisa] = useState(initial?.categoria_anvisa ?? '')
  const [unidade, setUnidade] = useState(initial?.unidade_padrao ?? '')
  const [custo, setCusto] = useState(initial?.custo_padrao?.toString() ?? '')
  const [fornecedorId, setFornecedorId] = useState(initial?.fornecedor_id ?? '')
  const [perdas, setPerdas] = useState(initial?.perdas_padrao?.toString() ?? '')
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '')
  const [ativo, setAtivo] = useState(initial?.ativo ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !groupId || !categoria || !unidade) return
    setSaving(true)
    setError('')

    const payload: Record<string, string | number | boolean | null> = {
      nome: nome.trim(),
      group_id: groupId,
      categoria,
      unidade_padrao: unidade,
      ativo,
    }
    if (codigo.trim()) payload.codigo = codigo.trim()
    if (categoriaAnvisa) payload.categoria_anvisa = categoriaAnvisa
    if (custo) payload.custo_padrao = Number(custo)
    if (fornecedorId) payload.fornecedor_id = fornecedorId
    if (perdas) payload.perdas_padrao = Number(perdas)
    if (observacoes.trim()) payload.observacoes = observacoes.trim()

    const url = initial ? `/api/produtos/${initial.id}` : '/api/produtos'
    const method = initial ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Erro ao salvar produto.')
      setSaving(false)
      return
    }

    router.push('/cadastros/produtos')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Nome *</label>
          <input value={nome} onChange={e => setNome(e.target.value)} required
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Código</label>
          <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="ex: PROD001"
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Grupo *</label>
          <select value={groupId} onChange={e => setGroupId(e.target.value)} required
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
            <option value="">Selecionar grupo</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Categoria *</label>
          <select value={categoria} onChange={e => setCategoria(e.target.value)} required
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
            <option value="">Selecionar</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Categoria ANVISA</label>
          <select value={categoriaAnvisa} onChange={e => setCategoriaAnvisa(e.target.value)}
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
            <option value="">Selecionar</option>
            {CATEGORIA_ANVISA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Unidade padrão *</label>
          <input value={unidade} onChange={e => setUnidade(e.target.value)} required placeholder="ex: kg, un, L"
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Custo padrão (R$)</label>
          <input type="number" value={custo} onChange={e => setCusto(e.target.value)} step="0.0001" min="0"
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Fornecedor</label>
          <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none">
            <option value="">Sem fornecedor</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Perdas padrão (%)</label>
          <input type="number" value={perdas} onChange={e => setPerdas(e.target.value)} step="0.1" min="0" max="100"
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-muted mb-1">Observações</label>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none resize-none" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-ink-muted">Ativo</label>
        <button type="button" onClick={() => setAtivo(a => !a)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ativo ? 'bg-fresh' : 'bg-surface-hover'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-ink transition-transform ${ativo ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {error && <p className="text-sm text-alert-bright">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-50 transition-colors">
          {saving ? 'Salvando...' : initial ? 'Salvar alterações' : 'Criar produto'}
        </button>
        <button type="button" onClick={() => router.push('/cadastros/produtos')}
          className="rounded-lg border border-edge-strong px-4 py-2 text-sm text-ink-muted hover:text-ink transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  )
}
