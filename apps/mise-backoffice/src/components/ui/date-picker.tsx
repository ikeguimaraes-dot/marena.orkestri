'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (v: string) => void
  withTime?: boolean
  required?: boolean
  placeholder?: string
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function parseLocal(val: string) {
  if (!val) return null
  const [datePart, timePart] = val.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [hh, mm] = (timePart ?? '').split(':').map(Number)
  return { y, m: m - 1, d, hh: hh || 0, mm: mm || 0 }
}

function toLocalString(y: number, m: number, d: number, hh: number, mm: number, withTime?: boolean) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${y}-${pad(m + 1)}-${pad(d)}`
  return withTime ? `${date}T${pad(hh)}:${pad(mm)}` : date
}

function formatDisplay(val: string, withTime?: boolean) {
  const p = parseLocal(val)
  if (!p) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${pad(p.d)}/${pad(p.m + 1)}/${p.y}`
  return withTime ? `${date} ${pad(p.hh)}:${pad(p.mm)}` : date
}

export function DatePicker({ value, onChange, withTime, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})

  const [draftDate, setDraftDate] = useState<{ y: number; m: number; d: number } | null>(null)
  const [draftHour, setDraftHour] = useState('00')
  const [draftMinute, setDraftMinute] = useState('00')
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())

  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function initDraft() {
    const p = parseLocal(value)
    if (p) {
      setDraftDate({ y: p.y, m: p.m, d: p.d })
      setViewYear(p.y)
      setViewMonth(p.m)
      setDraftHour(String(p.hh).padStart(2, '0'))
      setDraftMinute(String(p.mm).padStart(2, '0'))
    } else {
      setDraftDate(null)
      const now = new Date()
      setViewYear(now.getFullYear())
      setViewMonth(now.getMonth())
      setDraftHour('00')
      setDraftMinute('00')
    }
  }

  function updatePosition() {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setPanelStyle({ position: 'fixed', top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 288)) })
  }

  useEffect(() => {
    if (!open) return
    initDraft()
    updatePosition()

    function onOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleConfirm() {
    if (!draftDate) { setOpen(false); return }
    onChange(toLocalString(draftDate.y, draftDate.m, draftDate.d, Number(draftHour), Number(draftMinute), withTime))
    setOpen(false)
  }

  function handleClear() {
    onChange('')
    setOpen(false)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const now = new Date()
  const todayY = now.getFullYear()
  const todayM = now.getMonth()
  const todayD = now.getDate()

  const displayText = formatDisplay(value, withTime)

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-left focus:outline-none transition-colors hover:border-ink-subtle',
          displayText ? 'text-ink' : 'text-ink-subtle'
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-ink-muted" />
        <span className="flex-1">{displayText || placeholder || 'Selecionar data'}</span>
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ ...panelStyle, zIndex: 9999, width: '280px' }}
          className="rounded-xl border border-edge bg-surface shadow-xl"
        >
          {/* Navegação de mês */}
          <div className="flex items-center justify-between border-b border-edge px-3 py-2">
            <button type="button" onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised hover:text-ink transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-ink">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised hover:text-ink transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {DOW.map(d => (
              <div key={d} className="py-1 text-center text-[10px] font-medium text-ink-muted">{d}</div>
            ))}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-2">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />
              const isSelected = draftDate?.y === viewYear && draftDate?.m === viewMonth && draftDate?.d === day
              const isToday = viewYear === todayY && viewMonth === todayM && day === todayD
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setDraftDate({ y: viewYear, m: viewMonth, d: day })}
                  className={cn(
                    'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors',
                    isSelected
                      ? 'bg-ember text-ember-ink font-semibold'
                      : isToday
                        ? 'border border-ember text-ember hover:bg-ember-soft'
                        : 'text-ink hover:bg-surface-raised'
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Horário */}
          {withTime && (
            <div className="border-t border-edge px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-medium text-ink-muted uppercase tracking-wide">Horário</p>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={23}
                  value={draftHour}
                  onChange={e => setDraftHour(String(Math.min(23, Math.max(0, Number(e.target.value)))).padStart(2, '0'))}
                  className="w-16 rounded-lg border border-edge-strong bg-surface-raised px-2 py-1.5 text-center text-sm text-ink focus:outline-none"
                />
                <span className="text-ink-muted font-medium">:</span>
                <input
                  type="number" min={0} max={59}
                  value={draftMinute}
                  onChange={e => setDraftMinute(String(Math.min(59, Math.max(0, Number(e.target.value)))).padStart(2, '0'))}
                  className="w-16 rounded-lg border border-edge-strong bg-surface-raised px-2 py-1.5 text-center text-sm text-ink focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="flex items-center justify-between border-t border-edge px-3 py-2 gap-2">
            <button type="button" onClick={handleClear}
              className="text-sm text-ink-muted hover:text-ink transition-colors">
              Limpar
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)}
                className="rounded-lg border border-edge-strong px-3 py-1.5 text-sm text-ink-muted hover:text-ink transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirm} disabled={!draftDate}
                className="rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-ember-ink hover:bg-ember-hover disabled:opacity-40 transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
