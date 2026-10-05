'use client'

import { useState } from 'react'
import { Trash2, Plus, Pencil, Check, X } from 'lucide-react'

const TIPO_RESPOSTA_OPTIONS = [
  { value: 'sim_nao', label: 'Sim / Não' },
  { value: 'texto', label: 'Texto livre' },
  { value: 'selecao', label: 'Seleção' },
  { value: 'checklist_multiplo', label: 'Checklist múltiplo' },
  { value: 'data', label: 'Data' },
  { value: 'assinatura', label: 'Assinatura' },
]

const TIPO_RESPOSTA_LABEL: Record<string, string> = {
  sim_nao: 'Sim / Não',
  data: 'Data',
  selecao: 'Seleção',
  checklist_multiplo: 'Checklist múltiplo',
  assinatura: 'Assinatura',
  texto: 'Texto livre',
}

type Item = {
  id: string
  titulo: string
  descricao: string | null
  tipo_resposta: string
  opcoes: string[] | null
  ordem: number
  criterio_regramento: string | null
  requer_foto: string | null
}

type EditState = {
  titulo: string
  descricao: string
  tipo_resposta: string
  opcoes_str: string
  criterio_regramento: string
  requer_foto: string
}

type Props = {
  templateId: string
  initialItems: Item[]
}

export function EditarClient({ templateId, initialItems }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ titulo: '', descricao: '', tipo_resposta: 'sim_nao', opcoes_str: '', criterio_regramento: '', requer_foto: 'nao' })
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipoResposta, setTipoResposta] = useState('sim_nao')
  const [opcoesStr, setOpcoesStr] = useState('')
  const [criterioRegramentoAdd, setCriterioRegramentoAdd] = useState('')
  const [requerFotoAdd, setRequerFotoAdd] = useState('nao')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const needsOpcoesEdit = editState.tipo_resposta === 'selecao' || editState.tipo_resposta === 'checklist_multiplo'
  const needsOpcoesAdd = tipoResposta === 'selecao' || tipoResposta === 'checklist_multiplo'

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEditState({
      titulo: item.titulo,
      descricao: item.descricao ?? '',
      tipo_resposta: item.tipo_resposta,
      opcoes_str: item.opcoes?.join(', ') ?? '',
      criterio_regramento: item.criterio_regramento ?? '',
      requer_foto: item.requer_foto ?? 'nao',
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit(itemId: string) {
    if (!editState.titulo.trim()) return
    setSaving(true)
    const opcoes = needsOpcoesEdit
      ? editState.opcoes_str.split(',').map(s => s.trim()).filter(Boolean)
      : null

    try {
      const res = await fetch(`/api/checklists/${templateId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: editState.titulo.trim(),
          descricao: editState.descricao.trim() || null,
          tipo_resposta: editState.tipo_resposta,
          opcoes: opcoes && opcoes.length > 0 ? opcoes : null,
          criterio_regramento: editState.criterio_regramento.trim() || null,
          requer_foto: editState.requer_foto,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Erro ao salvar.')
        return
      }
      setItems(prev => prev.map(i => i.id === itemId ? data.item : i))
      setEditingId(null)
    } catch {
      alert('Erro ao salvar item.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemover(itemId: string) {
    setRemovingId(itemId)
    try {
      const res = await fetch(`/api/checklists/${templateId}/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(`Erro: ${data.error}`)
        return
      }
      setItems(prev => prev.filter(i => i.id !== itemId))
    } catch {
      alert('Erro ao remover item.')
    } finally {
      setRemovingId(null)
    }
  }

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return
    setAdding(true)
    setAddError('')

    const opcoes = needsOpcoesAdd
      ? opcoesStr.split(',').map(s => s.trim()).filter(Boolean)
      : null

    try {
      const res = await fetch(`/api/checklists/${templateId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          tipo_resposta: tipoResposta,
          opcoes: opcoes && opcoes.length > 0 ? opcoes : null,
          criterio_regramento: criterioRegramentoAdd.trim() || null,
          requer_foto: requerFotoAdd,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddError(data.error || 'Erro ao adicionar item.')
        return
      }
      setItems(prev => [...prev, data.item])
      setTitulo('')
      setDescricao('')
      setOpcoesStr('')
      setTipoResposta('sim_nao')
      setCriterioRegramentoAdd('')
      setRequerFotoAdd('nao')
    } catch {
      setAddError('Erro ao adicionar item.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Lista de itens */}
      <div className="rounded-xl border border-edge bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-edge">
          <span className="text-sm font-semibold text-ink">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-ink-subtle">
            Nenhum item. Adicione o primeiro abaixo.
          </div>
        ) : (
          <div className="divide-y divide-edge/60">
            {items.map(item => (
              <div key={item.id}>
                {editingId === item.id ? (
                  /* Modo edição inline */
                  <div className="px-4 py-4 bg-surface-raised/40 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-ink-muted mb-1">Título</label>
                        <input
                          value={editState.titulo}
                          onChange={e => setEditState(s => ({ ...s, titulo: e.target.value }))}
                          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ink-subtle focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-ink-muted mb-1">Tipo de resposta</label>
                        <select
                          value={editState.tipo_resposta}
                          onChange={e => setEditState(s => ({ ...s, tipo_resposta: e.target.value, opcoes_str: '' }))}
                          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none"
                        >
                          {TIPO_RESPOSTA_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-ink-muted mb-1">Descrição</label>
                        <input
                          value={editState.descricao}
                          onChange={e => setEditState(s => ({ ...s, descricao: e.target.value }))}
                          placeholder="Instrução adicional"
                          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none"
                        />
                      </div>
                      {needsOpcoesEdit && (
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-ink-muted mb-1">
                            Opções <span className="text-ink-faint">(separadas por vírgula)</span>
                          </label>
                          <input
                            value={editState.opcoes_str}
                            onChange={e => setEditState(s => ({ ...s, opcoes_str: e.target.value }))}
                            placeholder="ex: Conforme, Não conforme, N/A"
                            className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none"
                          />
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-ink-muted mb-1">Critério / Regramento</label>
                        <textarea
                          rows={2}
                          value={editState.criterio_regramento}
                          onChange={e => setEditState(s => ({ ...s, criterio_regramento: e.target.value }))}
                          placeholder="O que a norma exige (texto de apoio para o auditor)"
                          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none resize-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-ink-muted">Exige foto?</span>
                        {(['nao', 'sim'] as const).map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setEditState(s => ({ ...s, requer_foto: v }))}
                            className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${editState.requer_foto === v ? 'bg-ember text-white' : 'border border-edge text-ink-muted hover:text-ink'}`}
                          >
                            {v === 'sim' ? 'Sim' : 'Não'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={saving || !editState.titulo.trim()}
                        className="flex items-center gap-1.5 rounded-lg bg-ember px-3 py-1.5 text-xs font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-40 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {saving ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1.5 rounded-lg border border-edge-strong px-3 py-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Modo visualização */
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 min-w-[1.5rem] text-right text-xs font-mono text-ink-faint">{item.ordem}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink font-medium">{item.titulo}</p>
                      {item.descricao && (
                        <p className="text-xs text-ink-subtle mt-0.5">{item.descricao}</p>
                      )}
                      {item.opcoes && item.opcoes.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.opcoes.map((op, i) => (
                            <span key={i} className="rounded border border-edge-strong px-1.5 py-0.5 text-[10px] text-ink-muted">{op}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-surface-raised text-ink-muted">
                        {TIPO_RESPOSTA_LABEL[item.tipo_resposta] ?? item.tipo_resposta}
                      </span>
                      <button
                        onClick={() => startEdit(item)}
                        disabled={!!editingId}
                        className="flex h-7 w-7 items-center justify-center rounded text-ink-faint hover:bg-surface-raised hover:text-ink transition-colors disabled:opacity-30"
                        aria-label="Editar item"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemover(item.id)}
                        disabled={removingId === item.id || !!editingId}
                        className="flex h-7 w-7 items-center justify-center rounded text-ink-faint hover:bg-alert-soft hover:text-alert-bright transition-colors disabled:opacity-30"
                        aria-label="Remover item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulário novo item */}
      <div className="rounded-xl border border-edge bg-surface">
        <div className="border-b border-edge px-5 py-4">
          <p className="text-sm font-semibold text-ink flex items-center gap-2">
            <Plus className="h-4 w-4 text-ink-muted" />
            Adicionar item
          </p>
        </div>
        <form onSubmit={handleAdicionar} className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink-muted mb-1">Título *</label>
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="ex: Temperatura do freezer verificada"
                required
                className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ink-subtle focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Tipo de resposta *</label>
              <select
                value={tipoResposta}
                onChange={e => { setTipoResposta(e.target.value); setOpcoesStr('') }}
                className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none"
              >
                {TIPO_RESPOSTA_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Descrição (opcional)</label>
              <input
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Instrução adicional"
                className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ink-subtle focus:outline-none"
              />
            </div>
            {needsOpcoesAdd && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  Opções <span className="text-ink-faint">(separadas por vírgula)</span>
                </label>
                <input
                  value={opcoesStr}
                  onChange={e => setOpcoesStr(e.target.value)}
                  placeholder="ex: Conforme, Não conforme, N/A"
                  className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ink-subtle focus:outline-none"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-ink-muted mb-1">Critério / Regramento</label>
              <textarea
                rows={2}
                value={criterioRegramentoAdd}
                onChange={e => setCriterioRegramentoAdd(e.target.value)}
                placeholder="O que a norma exige (texto de apoio para o auditor)"
                className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:outline-none resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-muted">Exige foto?</span>
              {(['nao', 'sim'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRequerFotoAdd(v)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${requerFotoAdd === v ? 'bg-ember text-white' : 'border border-edge text-ink-muted hover:text-ink'}`}
                >
                  {v === 'sim' ? 'Sim' : 'Não'}
                </button>
              ))}
            </div>
          </div>

          {addError && <p className="text-sm text-alert-bright">{addError}</p>}

          <button
            type="submit"
            disabled={adding || !titulo.trim()}
            className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-40 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {adding ? 'Adicionando...' : 'Adicionar item'}
          </button>
        </form>
      </div>
    </div>
  )
}
