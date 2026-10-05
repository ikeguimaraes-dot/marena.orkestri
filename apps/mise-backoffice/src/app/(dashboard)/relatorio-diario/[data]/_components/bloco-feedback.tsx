'use client'
import { useState } from 'react'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { TextareaAuto } from './textarea-auto'
import { FEEDBACK_CATEGORIAS, FEEDBACK_CATEGORIA_LABEL, type FeedbackCategoria } from '@/app/api/relatorio-diario/_schema'
import { RegistroColapsavel } from './registro-colapsavel'

type FeedbackItem = { id: string; tipo: string; produto: string | null; categoria: string | null; descricao: string | null }

function catLabel(categoria: string | null): string {
  if (!categoria) return ''
  return FEEDBACK_CATEGORIA_LABEL[categoria] ?? categoria
}

export function BlocoFeedback({
  tipo,
  relatorioData,
  unitId,
  disabled,
  itensIniciais,
}: {
  tipo: 'elogio' | 'reclamacao'
  relatorioData: string
  unitId: string
  disabled?: boolean
  itensIniciais?: FeedbackItem[]
}) {
  const [itens, setItens] = useState<FeedbackItem[]>(itensIniciais ?? [])
  const [produto, setProduto] = useState('')
  const [categoria, setCategoria] = useState<FeedbackCategoria | ''>('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // estado de edição inline
  const [editId, setEditId] = useState<string | null>(null)
  const [editProduto, setEditProduto] = useState('')
  const [editCategoria, setEditCategoria] = useState<FeedbackCategoria | ''>('')
  const [editDescricao, setEditDescricao] = useState('')
  const [editErro, setEditErro] = useState('')

  const titulo = tipo === 'elogio' ? 'Elogios' : 'Reclamações'

  async function adicionar() {
    setSalvando(true); setErro('')
    const res = await fetch(`/api/relatorio-diario/${relatorioData}/registros/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unitId, tipo, produto: produto || null, categoria: categoria || null, descricao: descricao || null }),
    })
    if (res.ok) {
      const item = await res.json()
      // API devolve a linha do banco (campo texto) — normaliza pra descricao
      setItens(prev => [...prev, { id: item.id, tipo: item.tipo, produto: item.produto, categoria: item.categoria, descricao: item.texto ?? null }])
      setProduto(''); setCategoria(''); setDescricao('')
    } else {
      const { error } = await res.json()
      setErro(error ?? 'Erro ao adicionar.')
    }
    setSalvando(false)
  }

  function iniciarEdicao(item: FeedbackItem) {
    setEditId(item.id)
    setEditProduto(item.produto ?? '')
    setEditCategoria((item.categoria as FeedbackCategoria) || '')
    setEditDescricao(item.descricao ?? '')
    setEditErro('')
  }

  function cancelarEdicao() {
    setEditId(null); setEditErro('')
  }

  async function salvarEdicao(id: string) {
    setEditErro('')
    const res = await fetch(`/api/relatorio-diario/${relatorioData}/registros/feedback`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unitId, id, produto: editProduto || null, categoria: editCategoria || null, descricao: editDescricao || null }),
    })
    if (res.ok) {
      const item = await res.json()
      setItens(prev => prev.map(i => i.id === id
        ? { id: item.id, tipo: item.tipo, produto: item.produto, categoria: item.categoria, descricao: item.texto ?? null }
        : i))
      setEditId(null)
    } else {
      const { error } = await res.json()
      setEditErro(error ?? 'Erro ao salvar.')
    }
  }

  async function remover(id: string) {
    const res = await fetch(
      `/api/relatorio-diario/${relatorioData}/registros/feedback?unit_id=${unitId}&id=${id}`,
      { method: 'DELETE' }
    )
    if (res.ok) setItens(prev => prev.filter(i => i.id !== id))
  }

  async function apagarTudo() {
    await Promise.all(itens.map(item => remover(item.id)))
  }

  return (
    <RegistroColapsavel titulo={titulo} count={itens.length} onNao={apagarTudo}>
      {itens.map(item => (
        <div key={item.id} className="rounded-lg border border-edge bg-base px-3 py-2">
          {editId === item.id ? (
            // ----- modo edição -----
            <div className="space-y-2">
              <select
                value={editCategoria} onChange={e => setEditCategoria(e.target.value as FeedbackCategoria | '')}
                className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none"
              >
                <option value="">Categoria (opcional)…</option>
                {FEEDBACK_CATEGORIAS.map(c => <option key={c} value={c}>{FEEDBACK_CATEGORIA_LABEL[c]}</option>)}
              </select>
              <input
                type="text" value={editProduto} onChange={e => setEditProduto(e.target.value)}
                placeholder="Produto (opcional)"
                className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none"
              />
              <TextareaAuto
                value={editDescricao}
                onChange={setEditDescricao}
                placeholder="Descrição (opcional)…"
                className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none"
              />
              {editErro && <p className="text-xs text-alert-bright">{editErro}</p>}
              <div className="flex gap-2">
                <button onClick={() => salvarEdicao(item.id)}
                  className="flex items-center gap-1 rounded-lg bg-ember px-3 py-1.5 text-xs font-medium text-ember-ink hover:bg-ember-hover transition-colors">
                  <Check className="h-3.5 w-3.5" /> Salvar
                </button>
                <button onClick={cancelarEdicao}
                  className="flex items-center gap-1 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors">
                  <X className="h-3.5 w-3.5" /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            // ----- modo leitura (texto completo, sem clamp) -----
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {item.categoria && <p className="text-sm font-medium text-ink">{catLabel(item.categoria)}</p>}
                {item.produto && <p className="text-xs text-ink-muted break-words">{item.produto}</p>}
                {item.descricao && <p className="text-xs text-ink-subtle mt-0.5 whitespace-pre-wrap break-words">{item.descricao}</p>}
              </div>
              {!disabled && (
                <div className="flex shrink-0 gap-1 mt-0.5">
                  <button onClick={() => iniciarEdicao(item)} className="text-ink-faint hover:text-ember transition-colors" aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remover(item.id)} className="text-ink-faint hover:text-alert transition-colors" aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {!disabled && (
        <div className="space-y-2 pt-1">
          <select
            value={categoria} onChange={e => setCategoria(e.target.value as FeedbackCategoria | '')}
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none"
          >
            <option value="">Categoria (opcional)…</option>
            {FEEDBACK_CATEGORIAS.map(c => <option key={c} value={c}>{FEEDBACK_CATEGORIA_LABEL[c]}</option>)}
          </select>
          <input
            type="text" value={produto} onChange={e => setProduto(e.target.value)}
            placeholder="Produto (opcional)"
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none"
          />
          <TextareaAuto
            value={descricao}
            onChange={setDescricao}
            placeholder="Descrição (opcional)…"
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none"
          />
          {erro && <p className="text-xs text-alert-bright">{erro}</p>}
          <button
            onClick={adicionar} disabled={salvando}
            className="w-full rounded-lg bg-surface-raised border border-edge px-3 py-2 text-sm font-medium text-ink hover:bg-surface transition-colors disabled:opacity-50"
          >
            {salvando ? 'Adicionando…' : `+ Adicionar ${tipo === 'elogio' ? 'elogio' : 'reclamação'}`}
          </button>
        </div>
      )}
    </RegistroColapsavel>
  )
}
