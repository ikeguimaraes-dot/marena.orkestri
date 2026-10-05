'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, RotateCcw, Loader2, Camera, X } from 'lucide-react'

type Item = {
  id: string
  ordem: number
  titulo: string
  descricao: string | null
  tipo_resposta: 'sim_nao' | 'data' | 'selecao' | 'checklist_multiplo' | 'assinatura' | 'texto'
  opcoes: unknown
  peso: number
  requer_comentario: string
}

type StoredResponse = {
  item_id: string
  resposta: Record<string, unknown> | null
  comentario: string | null
  nao_aplicavel: boolean
  foto_url: string | null
}

type LocalAnswer = {
  resposta: Record<string, unknown> | null
  comentario: string
  nao_aplicavel: boolean
  foto_url?: string | null
}

function getOpcoes(item: Item): string[] {
  if (!item.opcoes) return []
  if (Array.isArray(item.opcoes)) return item.opcoes as string[]
  return []
}

function isAnswered(answer: LocalAnswer | undefined, item: Item): boolean {
  if (!answer) return false
  if (answer.nao_aplicavel) return true
  const r = answer.resposta
  if (!r) return false
  switch (item.tipo_resposta) {
    case 'sim_nao': return !!r.valor
    case 'data': return !!r.data
    case 'selecao': return !!r.valor
    case 'checklist_multiplo': return Array.isArray(r.selecionados) && (r.selecionados as string[]).length > 0
    case 'assinatura': return !!r.assinatura
    case 'texto': return typeof r.texto === 'string' && r.texto.trim().length > 0
    default: return false
  }
}

export function ExecucaoClient({
  executionId,
  templateNome,
  items,
  existingRespostas,
}: {
  executionId: string
  templateNome: string
  items: Item[]
  existingRespostas: StoredResponse[]
}) {
  const router = useRouter()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>(() => {
    const init: Record<string, LocalAnswer> = {}
    for (const r of existingRespostas) {
      init[r.item_id] = {
        resposta: r.resposta,
        comentario: r.comentario ?? '',
        nao_aplicavel: r.nao_aplicavel,
        foto_url: r.foto_url ?? null,
      }
    }
    return init
  })
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const photoTargetItemId = useRef<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ percentual: number; pontuacao_total: number; pontuacao_obtida: number } | null>(null)
  const [needsComment, setNeedsComment] = useState(false)

  // Canvas for signature
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const currentItem = items[currentIndex]
  const currentAnswer = currentItem ? (answers[currentItem.id] ?? { resposta: null, comentario: '', nao_aplicavel: false }) : null

  const answeredCount = items.filter(it => isAnswered(answers[it.id], it)).length
  const progress = items.length > 0 ? (answeredCount / items.length) * 100 : 0

  const saveToServer = useCallback(async (itemId: string, answer: LocalAnswer) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/checklists/execucoes/${executionId}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          resposta: answer.resposta,
          comentario: answer.comentario || null,
          nao_aplicavel: answer.nao_aplicavel,
          foto_url: answer.foto_url ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Erro ao salvar resposta:', res.status, err)
      }
    } catch (e) {
      console.error('Erro de rede ao salvar resposta:', e)
    } finally {
      setSaving(false)
    }
  }, [executionId])

  async function handlePhotoSelect(itemId: string, file: File) {
    setUploadingPhoto(itemId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('execution_id', executionId)
      fd.append('item_id', itemId)
      const res = await fetch('/api/checklists/upload-foto', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Erro ao fazer upload da foto:', res.status, err)
        return
      }
      const { url } = await res.json()
      const current = answers[itemId] ?? { resposta: null, comentario: '', nao_aplicavel: false }
      const updated = { ...current, foto_url: url }
      setAnswers(prev => ({ ...prev, [itemId]: updated }))
      await saveToServer(itemId, updated)
    } catch (e) {
      console.error('Erro de rede ao fazer upload da foto:', e)
    } finally {
      setUploadingPhoto(null)
    }
  }

  async function handleRemovePhoto(itemId: string) {
    const current = answers[itemId] ?? { resposta: null, comentario: '', nao_aplicavel: false }
    const updated = { ...current, foto_url: null }
    setAnswers(prev => ({ ...prev, [itemId]: updated }))
    await saveToServer(itemId, updated)
  }

  function updateAnswer(itemId: string, patch: Partial<LocalAnswer>) {
    setAnswers(prev => {
      const current = prev[itemId] ?? { resposta: null, comentario: '', nao_aplicavel: false }
      return { ...prev, [itemId]: { ...current, ...patch } }
    })
  }

  function goNext() {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(i => i + 1)
      setNeedsComment(false)
    } else {
      setShowSummary(true)
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1)
      setNeedsComment(false)
    }
  }

  async function handleSimNao(valor: 'sim' | 'nao') {
    if (!currentItem) return
    const answer: LocalAnswer = {
      resposta: { valor },
      comentario: currentAnswer?.comentario ?? '',
      nao_aplicavel: false,
      foto_url: currentAnswer?.foto_url ?? null,
    }
    const requiresComment = currentItem.requer_comentario === 'inconformidade' && valor === 'nao'
    updateAnswer(currentItem.id, answer)
    await saveToServer(currentItem.id, answer)
    if (requiresComment) {
      setNeedsComment(true)
    } else {
      setTimeout(goNext, 400)
    }
  }

  async function handleSelecao(valor: string) {
    if (!currentItem) return
    const answer: LocalAnswer = { resposta: { valor }, comentario: currentAnswer?.comentario ?? '', nao_aplicavel: false, foto_url: currentAnswer?.foto_url ?? null }
    updateAnswer(currentItem.id, answer)
    await saveToServer(currentItem.id, answer)
    setTimeout(goNext, 300)
  }

  async function handleCheckMultiplo(opcao: string, checked: boolean) {
    if (!currentItem) return
    const current = Array.isArray(currentAnswer?.resposta?.selecionados) ? [...(currentAnswer!.resposta!.selecionados as string[])] : []
    const updated = checked ? [...current, opcao] : current.filter(o => o !== opcao)
    const answer: LocalAnswer = { resposta: { selecionados: updated }, comentario: currentAnswer?.comentario ?? '', nao_aplicavel: false, foto_url: currentAnswer?.foto_url ?? null }
    updateAnswer(currentItem.id, answer)
    await saveToServer(currentItem.id, answer)
  }

  // Canvas drawing
  function getCanvasPos(e: React.TouchEvent | React.MouseEvent): { x: number; y: number } {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    isDrawing.current = true
    lastPos.current = getCanvasPos(e)
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    if (!isDrawing.current || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')!
    const pos = getCanvasPos(e)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  async function endDraw() {
    isDrawing.current = false
    lastPos.current = null
    if (!canvasRef.current || !currentItem) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    const answer: LocalAnswer = { resposta: { assinatura: dataUrl }, comentario: currentAnswer?.comentario ?? '', nao_aplicavel: false, foto_url: currentAnswer?.foto_url ?? null }
    updateAnswer(currentItem.id, answer)
    await saveToServer(currentItem.id, answer)
  }

  function clearCanvas() {
    if (!canvasRef.current || !currentItem) return
    const ctx = canvasRef.current.getContext('2d')!
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    updateAnswer(currentItem.id, { resposta: null })
  }

  async function handleConcluir() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/checklists/execucoes/${executionId}/concluir`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResult(json)
    } catch (e) {
      alert(`Erro ao concluir: ${e instanceof Error ? e.message : 'desconhecido'}`)
      setSubmitting(false)
    }
  }

  // Result screen
  if (result) {
    const pct = result.percentual
    const color = pct >= 80 ? '#34d399' : pct >= 60 ? '#facc15' : '#f87171'
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-base px-6 text-center gap-6">
        <CheckCircle2 className="h-16 w-16 text-fresh-bright" />
        <h2 className="text-2xl font-bold text-ink">Checklist concluído!</h2>
        <div style={{ color }} className="text-6xl font-black">{pct.toFixed(0)}%</div>
        <p className="text-ink-muted">{Number(result.pontuacao_obtida).toFixed(1)} de {result.pontuacao_total} pontos</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => router.push(`/checklists/historico/${executionId}`)}
            className="w-full rounded-lg bg-ember py-3 font-bold text-ember-ink hover:bg-ember-hover"
          >
            Ver relatório completo
          </button>
          <button
            onClick={() => router.push('/checklists')}
            className="w-full rounded-lg border border-edge-strong py-3 text-ink-muted hover:bg-surface"
          >
            Voltar aos checklists
          </button>
        </div>
      </div>
    )
  }

  // Summary before submit
  if (showSummary) {
    const unanswered = items.filter(it => !isAnswered(answers[it.id], it))
    return (
      <div className="flex flex-col min-h-screen bg-base px-4 py-6 gap-4 max-w-lg mx-auto">
        <h2 className="text-xl font-bold text-ink">Resumo</h2>
        <div className="rounded-lg border border-edge bg-surface p-4 text-center">
          <div className="text-3xl font-black text-ink">{answeredCount}/{items.length}</div>
          <div className="text-sm text-ink-muted mt-1">itens respondidos</div>
          <div className="mt-3 h-2 bg-surface-raised rounded-full overflow-hidden">
            <div className="h-full bg-ember transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {unanswered.length > 0 && (
          <div className="rounded-lg border border-warn/30 bg-warn/5 p-4">
            <p className="text-sm font-semibold text-warn-bright mb-2">{unanswered.length} {unanswered.length === 1 ? 'item sem resposta' : 'itens sem resposta'}:</p>
            <ul className="space-y-1">
              {unanswered.map(it => (
                <li key={it.id} className="text-xs text-ink-muted flex items-center gap-2">
                  <span className="text-ink-faint">{it.ordem}.</span> {it.titulo}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-auto">
          <button
            onClick={handleConcluir}
            disabled={submitting}
            className="w-full rounded-lg bg-ember py-4 font-bold text-ember-ink hover:bg-ember-hover disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : 'Concluir e calcular score'}
          </button>
          <button
            onClick={() => { setShowSummary(false); setCurrentIndex(items.length - 1) }}
            className="w-full rounded-lg border border-edge-strong py-3 text-ink-muted hover:bg-surface"
          >
            Voltar e revisar
          </button>
        </div>
      </div>
    )
  }

  if (!currentItem) return <div className="p-6 text-ink-muted">Nenhum item.</div>

  const opcoes = getOpcoes(currentItem)
  const answered = isAnswered(currentAnswer ?? undefined, currentItem)

  return (
    <div className="flex flex-col min-h-screen bg-base">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-base border-b border-edge px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-ink-subtle truncate max-w-[200px]">{templateNome}</span>
          <span className="text-xs text-ink-muted font-mono">{currentIndex + 1}/{items.length}</span>
        </div>
        <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
          <div className="h-full bg-ember transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Item */}
      <div className="flex-1 px-4 py-6 flex flex-col gap-5 max-w-lg mx-auto w-full">
        <div>
          <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wider mb-1">Item {currentItem.ordem}</p>
          <h2 className="text-xl font-bold text-ink leading-snug">{currentItem.titulo}</h2>
          {currentItem.descricao && <p className="mt-1.5 text-sm text-ink-muted">{currentItem.descricao}</p>}
        </div>

        {/* Response area */}
        <div className="flex-1 flex flex-col gap-3">
          {/* N/A toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-warn"
              checked={currentAnswer?.nao_aplicavel ?? false}
              onChange={e => {
                updateAnswer(currentItem.id, { nao_aplicavel: e.target.checked, resposta: e.target.checked ? null : currentAnswer?.resposta ?? null })
                if (e.target.checked && currentAnswer) saveToServer(currentItem.id, { ...currentAnswer, nao_aplicavel: true })
              }}
            />
            <span className="text-sm text-ink-muted">Não aplicável</span>
          </label>

          {!currentAnswer?.nao_aplicavel && (
            <>
              {/* SIM / NÃO */}
              {currentItem.tipo_resposta === 'sim_nao' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSimNao('sim')}
                    className={`flex-1 rounded-xl py-6 font-bold text-lg flex flex-col items-center gap-1 transition-all ${
                      currentAnswer?.resposta?.valor === 'sim'
                        ? 'bg-fresh-soft border border-fresh text-fresh-bright shadow-lg shadow-fresh-soft/40'
                        : 'bg-surface border border-edge-strong text-ink-muted hover:border-fresh'
                    }`}
                  >
                    <CheckCircle2 className="h-8 w-8" />
                    Conforme
                  </button>
                  <button
                    onClick={() => handleSimNao('nao')}
                    className={`flex-1 rounded-xl py-6 font-bold text-lg flex flex-col items-center gap-1 transition-all ${
                      currentAnswer?.resposta?.valor === 'nao'
                        ? 'bg-alert-soft border border-alert text-alert-bright shadow-lg shadow-alert-soft/40'
                        : 'bg-surface border border-edge-strong text-ink-muted hover:border-alert'
                    }`}
                  >
                    <XCircle className="h-8 w-8" />
                    Não conforme
                  </button>
                </div>
              )}

              {/* Comment required for inconformidade */}
              {needsComment && currentItem.tipo_resposta === 'sim_nao' && (
                <div>
                  <label className="block text-xs font-semibold text-alert-bright mb-1">Comentário obrigatório</label>
                  <textarea
                    className="w-full rounded-lg bg-surface border border-alert/50 px-3 py-2 text-sm text-ink placeholder-ink-faint resize-none focus:outline-none focus:border-alert-bright"
                    rows={3}
                    placeholder="Descreva a inconformidade..."
                    value={currentAnswer?.comentario ?? ''}
                    onChange={e => updateAnswer(currentItem.id, { comentario: e.target.value })}
                  />
                  <button
                    onClick={async () => {
                      if (!currentAnswer?.comentario?.trim()) return
                      await saveToServer(currentItem.id, currentAnswer!)
                      setNeedsComment(false)
                      goNext()
                    }}
                    className="mt-2 w-full rounded-lg bg-ember py-2 text-sm font-bold text-ember-ink hover:bg-ember-hover"
                  >
                    Registrar e continuar
                  </button>
                </div>
              )}

              {/* SELEÇÃO */}
              {currentItem.tipo_resposta === 'selecao' && (
                <div className="flex flex-col gap-2">
                  {opcoes.map(op => (
                    <button
                      key={op}
                      onClick={() => handleSelecao(op)}
                      className={`w-full rounded-xl px-4 py-4 text-left font-semibold transition-all ${
                        currentAnswer?.resposta?.valor === op
                          ? 'bg-ember text-ember-ink'
                          : 'bg-surface border border-edge-strong text-ink-muted hover:border-ember'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              )}

              {/* CHECKLIST MÚLTIPLO */}
              {currentItem.tipo_resposta === 'checklist_multiplo' && (
                <div className="flex flex-col gap-2">
                  {opcoes.map(op => {
                    const checked = Array.isArray(currentAnswer?.resposta?.selecionados)
                      ? (currentAnswer!.resposta!.selecionados as string[]).includes(op)
                      : false
                    return (
                      <label
                        key={op}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3.5 cursor-pointer transition-all ${
                          checked
                            ? 'bg-fresh-soft border border-fresh/50 text-fresh-bright'
                            : 'bg-surface border border-edge-strong text-ink-muted hover:border-fresh'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-fresh h-5 w-5 shrink-0"
                          checked={checked}
                          onChange={e => handleCheckMultiplo(op, e.target.checked)}
                        />
                        <span className="text-sm">{op}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {/* DATA */}
              {currentItem.tipo_resposta === 'data' && (
                <input
                  type="date"
                  className="w-full rounded-lg bg-surface border border-edge-strong px-4 py-3 text-ink focus:outline-none focus:border-ember text-lg"
                  value={(currentAnswer?.resposta?.data as string) ?? ''}
                  onChange={async e => {
                    const answer: LocalAnswer = { resposta: { data: e.target.value }, comentario: currentAnswer?.comentario ?? '', nao_aplicavel: false, foto_url: currentAnswer?.foto_url ?? null }
                    updateAnswer(currentItem.id, answer)
                    if (e.target.value) await saveToServer(currentItem.id, answer)
                  }}
                />
              )}

              {/* TEXTO */}
              {currentItem.tipo_resposta === 'texto' && (
                <textarea
                  className="w-full rounded-lg bg-surface border border-edge-strong px-4 py-3 text-ink placeholder-ink-faint resize-none focus:outline-none focus:border-ember"
                  rows={5}
                  placeholder="Digite sua resposta..."
                  value={(currentAnswer?.resposta?.texto as string) ?? ''}
                  onChange={async e => {
                    const answer: LocalAnswer = { resposta: { texto: e.target.value }, comentario: currentAnswer?.comentario ?? '', nao_aplicavel: false, foto_url: currentAnswer?.foto_url ?? null }
                    updateAnswer(currentItem.id, answer)
                    await saveToServer(currentItem.id, answer)
                  }}
                />
              )}

              {/* ASSINATURA */}
              {currentItem.tipo_resposta === 'assinatura' && (
                <div>
                  <div className="rounded-xl border border-edge-strong overflow-hidden bg-surface touch-none">
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={200}
                      className="w-full cursor-crosshair"
                      style={{ touchAction: 'none' }}
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={endDraw}
                      onMouseLeave={endDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={endDraw}
                    />
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-xs text-ink-subtle">Assine com o dedo acima</span>
                    <button onClick={clearCanvas} className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
                      <RotateCcw className="h-3.5 w-3.5" /> Limpar
                    </button>
                  </div>
                  {!!(currentAnswer?.resposta?.assinatura) && (
                    <p className="text-xs text-fresh-bright mt-1">✓ Assinatura registrada</p>
                  )}
                </div>
              )}

              {/* Optional comment (not sim_nao inconformidade) */}
              {currentItem.requer_comentario === 'opcional' && (
                <div>
                  <label className="block text-xs text-ink-subtle mb-1">Comentário (opcional)</label>
                  <textarea
                    className="w-full rounded-lg bg-surface border border-edge px-3 py-2 text-sm text-ink placeholder-ink-faint resize-none focus:outline-none focus:border-edge-strong"
                    rows={2}
                    value={currentAnswer?.comentario ?? ''}
                    onChange={e => updateAnswer(currentItem.id, { comentario: e.target.value })}
                    onBlur={async () => {
                      if (currentAnswer) await saveToServer(currentItem.id, currentAnswer)
                    }}
                  />
                </div>
              )}

              {/* Photo */}
              <div className="flex items-center gap-3 pt-1">
                {currentAnswer?.foto_url ? (
                  <div className="relative shrink-0">
                    <img
                      src={currentAnswer.foto_url}
                      alt="Foto"
                      className="h-20 w-20 object-cover rounded-lg border border-edge"
                    />
                    <button
                      onClick={() => handleRemovePhoto(currentItem.id)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-surface-raised border border-edge-strong flex items-center justify-center hover:bg-alert-soft"
                    >
                      <X className="h-3 w-3 text-ink-muted" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { photoTargetItemId.current = currentItem.id; photoInputRef.current?.click() }}
                    disabled={uploadingPhoto === currentItem.id}
                    className="flex items-center gap-1.5 text-xs text-ink-subtle hover:text-ember border border-edge rounded-lg px-3 py-2 hover:border-ember disabled:opacity-40 transition-colors"
                  >
                    {uploadingPhoto === currentItem.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Camera className="h-3.5 w-3.5" />}
                    Foto
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hidden file input for photo capture */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          const itemId = photoTargetItemId.current
          if (file && itemId) handlePhotoSelect(itemId, file)
          e.target.value = ''
        }}
      />

      {/* Navigation footer */}
      <div className="sticky bottom-0 bg-base border-t border-edge px-4 py-3 flex gap-3">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="rounded-lg border border-edge-strong px-4 py-3 text-ink-muted hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <button
          onClick={goNext}
          className={`flex-1 rounded-lg py-3 font-bold flex items-center justify-center gap-1 transition-colors ${
            answered
              ? 'bg-ember text-ember-ink hover:bg-ember-hover'
              : currentIndex === items.length - 1
                ? 'bg-surface-hover text-ink hover:bg-edge-strong'
                : 'bg-surface-raised text-ink-muted hover:bg-surface-hover'
          }`}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {currentIndex === items.length - 1 ? 'Ver resumo' : 'Próximo'}
          {currentIndex < items.length - 1 && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
