// v3
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play } from 'lucide-react'

export function TemplateDetailClient({ templateId, unitId }: { templateId: string; unitId: string | null }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleExecutar() {
    if (!unitId) {
      alert('Template sem unidade definida.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/checklists/execucoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, unit_id: unitId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      router.push(`/checklists/executar/${json.id}`)
    } catch (e) {
      alert(`Erro: ${e instanceof Error ? e.message : 'desconhecido'}`)
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExecutar}
      disabled={loading}
      className="flex items-center gap-2 rounded-md bg-ember px-4 py-2 text-sm font-bold text-ember-ink hover:bg-ember-hover disabled:opacity-50 transition-colors shrink-0"
    >
      <Play className="h-4 w-4" />
      {loading ? 'Iniciando...' : 'Executar agora'}
    </button>
  )
}
