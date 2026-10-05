'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Plus,
  X,
  ChevronLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'

type Unit = { id: string; name: string }
type TipoResposta = 'sim_nao' | 'data' | 'selecao' | 'checklist_multiplo' | 'assinatura' | 'texto'

type HeaderState = {
  nome: string
  tipo: string
  unit_id: string
  descricao: string
  categoria: string
}

type FormItem = {
  id: string
  titulo: string
  descricao: string
  tipo_resposta: TipoResposta
  opcoes_str: string
  peso: number
}

const TIPOS = [
  { value: 'abertura', label: 'Abertura' },
  { value: 'fechamento', label: 'Fechamento' },
  { value: 'rotina', label: 'Rotina' },
  { value: 'relatorio', label: 'Relatório' },
  { value: 'treinamento', label: 'Treinamento' },
]

const TIPO_RESPOSTA_OPTIONS = [
  { value: 'sim_nao', label: 'Sim / Não' },
  { value: 'data', label: 'Data' },
  { value: 'selecao', label: 'Seleção' },
  { value: 'checklist_multiplo', label: 'Checklist múltiplo' },
  { value: 'assinatura', label: 'Assinatura' },
  { value: 'texto', label: 'Texto livre' },
]

const INPUT_CLASS =
  'w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink placeholder-ink-subtle focus:border-ink-subtle focus:outline-none'

// ─── SortableItem ────────────────────────────────────────────────────────────

function SortableItem({
  item,
  onChange,
  onRemove,
  disabled,
}: {
  item: FormItem
  onChange: (patch: Partial<FormItem>) => void
  onRemove: () => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  const needsOpcoes =
    item.tipo_resposta === 'selecao' || item.tipo_resposta === 'checklist_multiplo'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-surface transition-opacity ${
        isDragging ? 'border-ember/50 shadow-lg opacity-70' : 'border-edge'
      }`}
      {...attributes}
    >
      <div className="flex items-start gap-2 p-3">
        {/* Drag handle */}
        <button
          type="button"
          {...listeners}
          className="mt-2 shrink-0 cursor-grab active:cursor-grabbing text-ink-faint hover:text-ink-muted touch-none"
          tabIndex={-1}
          aria-label="Arrastar item"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Fields */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <input
                type="text"
                placeholder="Título do item *"
                value={item.titulo}
                onChange={e => onChange({ titulo: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <select
                value={item.tipo_resposta}
                onChange={e =>
                  onChange({ tipo_resposta: e.target.value as TipoResposta, opcoes_str: '' })
                }
                className={INPUT_CLASS}
              >
                {TIPO_RESPOSTA_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Descrição (opcional)"
                value={item.descricao}
                onChange={e => onChange({ descricao: e.target.value })}
                className={`${INPUT_CLASS} flex-1`}
              />
              <div className="flex items-center gap-1 shrink-0">
                <label className="text-xs text-ink-subtle whitespace-nowrap">Peso</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={item.peso}
                  onChange={e => onChange({ peso: Math.max(0, Number(e.target.value)) })}
                  className="w-14 rounded-lg border border-edge-strong bg-surface-raised px-2 py-2 text-sm text-ink text-center focus:outline-none"
                />
              </div>
            </div>

            {needsOpcoes && (
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Opções separadas por vírgula  (ex: Conforme, Não conforme, N/A)"
                  value={item.opcoes_str}
                  onChange={e => onChange({ opcoes_str: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
            )}
          </div>
        </div>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="mt-1 shrink-0 flex h-7 w-7 items-center justify-center rounded text-ink-faint hover:bg-alert-soft hover:text-alert-bright transition-colors disabled:opacity-30"
          aria-label="Remover item"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── ItemPreview ─────────────────────────────────────────────────────────────

function ItemPreview({ item, index }: { item: FormItem; index: number }) {
  const opcoes = item.opcoes_str
    ? item.opcoes_str.split(',').map(s => s.trim()).filter(Boolean)
    : []

  return (
    <div className="rounded-lg border border-edge bg-surface-raised/40 p-3">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-[10px] font-mono text-ink-faint mt-0.5 shrink-0">{index + 1}.</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink leading-snug">
            {item.titulo ? item.titulo : <span className="text-ink-faint italic">Sem título</span>}
          </p>
          {item.descricao && (
            <p className="mt-0.5 text-[10px] text-ink-subtle leading-tight">{item.descricao}</p>
          )}
        </div>
      </div>

      <div className="ml-4">
        {item.tipo_resposta === 'sim_nao' && (
          <div className="flex gap-1.5">
            <div className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-edge-strong py-1.5 text-[10px] text-ink-muted">
              <CheckCircle2 className="h-3 w-3" /> Conforme
            </div>
            <div className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-edge-strong py-1.5 text-[10px] text-ink-muted">
              <XCircle className="h-3 w-3" /> Não conforme
            </div>
          </div>
        )}

        {item.tipo_resposta === 'data' && (
          <div className="rounded border border-edge-strong bg-surface/50 px-2 py-1 text-[10px] text-ink-subtle">
            DD/MM/AAAA
          </div>
        )}

        {item.tipo_resposta === 'texto' && (
          <div className="rounded border border-edge-strong bg-surface/50 px-2 py-1 text-[10px] text-ink-subtle h-8">
            Texto livre...
          </div>
        )}

        {item.tipo_resposta === 'assinatura' && (
          <div className="rounded border border-dashed border-edge-strong py-3 text-center text-[10px] text-ink-subtle">
            Área de assinatura
          </div>
        )}

        {(item.tipo_resposta === 'selecao' || item.tipo_resposta === 'checklist_multiplo') && (
          <div className="space-y-1">
            {opcoes.length === 0 ? (
              <div className="text-[10px] text-ink-faint italic">Nenhuma opção definida</div>
            ) : (
              <>
                {opcoes.slice(0, 4).map((op, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded border border-edge-strong px-2 py-1 text-[10px] text-ink-muted"
                  >
                    {item.tipo_resposta === 'checklist_multiplo' ? (
                      <div className="h-3 w-3 rounded border border-ink-faint shrink-0" />
                    ) : (
                      <div className="h-2.5 w-2.5 rounded-full border border-ink-faint shrink-0" />
                    )}
                    {op}
                  </div>
                ))}
                {opcoes.length > 4 && (
                  <div className="text-[10px] text-ink-faint pl-1">
                    +{opcoes.length - 4} mais...
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {item.peso === 0 && (
          <div className="mt-1.5 text-[10px] text-ink-faint">Informativo — não pontua</div>
        )}
      </div>
    </div>
  )
}

// ─── ChecklistForm ────────────────────────────────────────────────────────────

const CATEGORIAS_CRIVO = [
  { value: 'documentacao', label: 'Documentação' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'estrutural', label: 'Estrutural' },
]

export function ChecklistForm({ units, modulo = 'RITMO' }: { units: Unit[]; modulo?: string }) {
  const router = useRouter()
  const idCounter = useRef(0)
  const newId = () => {
    idCounter.current += 1
    return `item-${idCounter.current}`
  }

  const isCrivo = modulo === 'CRIVO'
  const [step, setStep] = useState<1 | 2>(1)
  const [header, setHeader] = useState<HeaderState>({
    nome: '',
    tipo: 'abertura',
    unit_id: '',
    descricao: '',
    categoria: 'documentacao',
  })
  const [items, setItems] = useState<FormItem[]>([
    { id: newId(), titulo: '', descricao: '', tipo_resposta: 'sim_nao', opcoes_str: '', peso: 1 },
  ])
  const [submitting, setSubmitting] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setItems(prev => {
        const oldIndex = prev.findIndex(i => i.id === active.id)
        const newIndex = prev.findIndex(i => i.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  function addItem() {
    setItems(prev => [
      ...prev,
      { id: newId(), titulo: '', descricao: '', tipo_resposta: 'sim_nao', opcoes_str: '', peso: 1 },
    ])
  }

  function updateItem(id: string, patch: Partial<FormItem>) {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  async function handleSubmit() {
    const validItems = items.filter(item => item.titulo.trim())
    if (validItems.length === 0) {
      alert('Adicione pelo menos um item com título.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: header.nome.trim(),
          tipo: header.tipo || null,
          descricao: header.descricao.trim() || null,
          unit_id: header.unit_id || null,
          modulo,
          categoria: isCrivo ? header.categoria : null,
          itens: validItems.map((item, index) => ({
            titulo: item.titulo.trim(),
            descricao: item.descricao.trim() || null,
            tipo_resposta: item.tipo_resposta,
            opcoes:
              (item.tipo_resposta === 'selecao' || item.tipo_resposta === 'checklist_multiplo') &&
              item.opcoes_str
                ? item.opcoes_str.split(',').map(s => s.trim()).filter(Boolean)
                : null,
            peso: item.peso,
            ordem: index + 1,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao criar checklist')
      router.push(isCrivo ? `/crivo/templates` : `/checklists/${json.id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro desconhecido')
      setSubmitting(false)
    }
  }

  const validItemCount = items.filter(i => i.titulo.trim()).length

  // ── Step 1: Header ──────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="max-w-lg">
        <div className="rounded-xl border border-edge bg-surface p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Nome do checklist *
            </label>
            <input
              type="text"
              placeholder="ex: Abertura da Cozinha — Almoço"
              value={header.nome}
              onChange={e => setHeader(s => ({ ...s, nome: e.target.value }))}
              autoFocus
              className={INPUT_CLASS}
              onKeyDown={e => {
                if (e.key === 'Enter' && header.nome.trim()) setStep(2)
              }}
            />
          </div>

          {isCrivo && (
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Categoria *</label>
              <select
                value={header.categoria}
                onChange={e => setHeader(s => ({ ...s, categoria: e.target.value }))}
                className={INPUT_CLASS}
              >
                {CATEGORIAS_CRIVO.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {!isCrivo && <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Tipo</label>
              <select
                value={header.tipo}
                onChange={e => setHeader(s => ({ ...s, tipo: e.target.value }))}
                className={INPUT_CLASS}
              >
                {TIPOS.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>}
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Unidade</label>
              <select
                value={header.unit_id}
                onChange={e => setHeader(s => ({ ...s, unit_id: e.target.value }))}
                className={INPUT_CLASS}
              >
                <option value="">Todas as unidades</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Descrição (opcional)
            </label>
            <textarea
              placeholder="Descreva o objetivo deste checklist..."
              value={header.descricao}
              onChange={e => setHeader(s => ({ ...s, descricao: e.target.value }))}
              rows={3}
              className={`${INPUT_CLASS} resize-none`}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setStep(2)}
            disabled={!header.nome.trim()}
            className="flex items-center gap-2 rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-40 transition-colors"
          >
            Próximo <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  // ── Step 2: Items ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Left — item list */}
      <div className="flex-1 min-w-0">
        {/* Step breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-ink-subtle mb-4 flex-wrap">
          <button
            onClick={() => setStep(1)}
            className="hover:text-ink-muted transition-colors truncate max-w-[200px]"
          >
            {header.nome}
          </button>
          <span>/</span>
          <span className="text-ink">Itens</span>
          {validItemCount > 0 && (
            <span className="text-ink-faint">
              ({validItemCount} {validItemCount === 1 ? 'item' : 'itens'})
            </span>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map(item => (
                <SortableItem
                  key={item.id}
                  item={item}
                  onChange={patch => updateItem(item.id, patch)}
                  onRemove={() => removeItem(item.id)}
                  disabled={submitting}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={addItem}
          disabled={submitting}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-ember/40 py-3 text-sm text-ember hover:border-ember hover:bg-ember-soft disabled:opacity-40 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Adicionar item
        </button>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setStep(1)}
            disabled={submitting}
            className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || validItemCount === 0}
            className="flex items-center gap-2 rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-40 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Criando...
              </>
            ) : (
              'Criar Checklist'
            )}
          </button>
        </div>
      </div>

      {/* Right — preview */}
      <div className="lg:w-72 lg:sticky lg:top-6 shrink-0">
        <div className="rounded-xl border border-edge bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-edge">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle mb-0.5">
              Preview
            </p>
            <p className="text-sm font-bold text-ink truncate">
              {header.nome || 'Nome do checklist'}
            </p>
            {header.tipo && (
              <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-surface-raised text-ink-muted">
                {TIPOS.find(t => t.value === header.tipo)?.label ?? header.tipo}
              </span>
            )}
          </div>
          <div className="p-3 space-y-2 max-h-[560px] overflow-y-auto">
            {validItemCount === 0 ? (
              <p className="text-[10px] text-ink-faint text-center py-6">
                Adicione itens para ver o preview
              </p>
            ) : (
              items
                .filter(i => i.titulo.trim())
                .map((item, index) => (
                  <ItemPreview key={item.id} item={item} index={index} />
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
