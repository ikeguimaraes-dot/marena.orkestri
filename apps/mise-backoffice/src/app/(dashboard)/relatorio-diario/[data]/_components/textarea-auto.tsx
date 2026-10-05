'use client'
import { useRef, useEffect } from 'react'

export function TextareaAuto({
  value,
  onChange,
  disabled,
  placeholder,
  className,
  id,
  minRows = 2,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  id?: string
  minRows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      rows={minRows}
      className={`${className ?? ''} resize-none overflow-hidden`}
    />
  )
}
