'use client'

import { useState } from 'react'
import { Upload, CheckCircle, AlertTriangle } from 'lucide-react'

type Resultado = {
  inseridos: number
  atualizados: number
  ignorados: number
  total_planilha: number
}

export function ImportarProdutosForm() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
    setResultado(null)
    setError('')
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setError('')
    setResultado(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/produtos/importar', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao importar a planilha.')
        return
      }

      setResultado(data)
    } catch {
      setError('Erro de rede ao enviar o arquivo. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl rounded-xl border border-edge bg-surface p-5 space-y-4">
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1">Arquivo (.xlsx ou .csv)</label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="w-full rounded-lg border border-edge-strong bg-surface-raised px-3 py-2 text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-ember file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ember-ink file:cursor-pointer"
        />
      </div>

      <button
        type="button"
        onClick={handleImport}
        disabled={!file || loading}
        className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-ember-ink hover:bg-ember-hover disabled:opacity-50 transition-colors"
      >
        <Upload className="h-4 w-4" />
        {loading ? 'Importando...' : 'Importar planilha'}
      </button>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-alert/40 bg-alert-soft px-4 py-3 text-sm text-alert-bright">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {resultado && (
        <div className="flex items-start gap-2 rounded-lg border border-fresh/40 bg-fresh-soft px-4 py-3 text-sm text-fresh-bright">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Importação concluída.</p>
            <p>
              {resultado.inseridos} inserido{resultado.inseridos !== 1 ? 's' : ''} ·{' '}
              {resultado.atualizados} atualizado{resultado.atualizados !== 1 ? 's' : ''} ·{' '}
              {resultado.ignorados} ignorado{resultado.ignorados !== 1 ? 's' : ''} ·{' '}
              {resultado.total_planilha} linha{resultado.total_planilha !== 1 ? 's' : ''} na planilha
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
