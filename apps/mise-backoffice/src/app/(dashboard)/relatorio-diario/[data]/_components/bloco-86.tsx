'use client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { OP_86_MOTIVOS, type Op86Motivo } from '@/app/api/relatorio-diario/_schema'
import { RegistroColapsavel } from './registro-colapsavel'

type Item86 = { id: string; produto_nome: string; motivo: Op86Motivo }

const MOTIVO_LABEL: Record<Op86Motivo, string> = {
  compra_gestao: 'Compra/Gestão',
  producao_planejamento: 'Produção/Planejamento',
  fornecedor_ruptura: 'Fornecedor/Ruptura',
  padrao_qualidade: 'Padrão/Qualidade',
  sazonalidade: 'Sazonalidade',
}

export function Bloco86({
  relatorioData,
  unitId,
  disabled,
  itensIniciais,
}: {
  relatorioData: string
  unitId: string
  disabled?: boolean
  itensIniciais?: Item86[]
}) {
  const [itens, setItens] = useState<Item86[]>(itensIniciais ?? [])
  const [produto, setProduto] = useState('')
  const [motivo, setMotivo] = useState<Op86Motivo | ''>('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function adicionar() {
    if (!produto.trim() || !motivo) { setErro('Produto e motivo obrigatórios.'); return }
    setSalvando(true); setErro('')
    const res = await fetch(`/api/relatorio-diario/${relatorioData}/registros/86`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unitId, produto_nome: produto.trim(), motivo }),
    })
    if (res.ok) {
      const item = await res.json()
      setItens(prev => [...prev, item])
      setProduto(''); setMotivo('')
    } else {
      const { error } = await res.json()
      setErro(error ?? 'Erro ao adicionar.')
    }
    setSalvando(false)
  }

  async function remover(id: string) {
    const res = await fetch(
      `/api/relatorio-diario/${relatorioData}/registros/86?unit_id=${unitId}&id=${id}`,
      { method: 'DELETE' }
    )
    if (res.ok) setItens(prev => prev.filter(i => i.id !== id))
  }

  async function apagarTudo() {
    await Promise.all(itens.map(item => remover(item.id)))
  }

  return (
    <RegistroColapsavel titulo="86 (Produto em falta)" count={itens.length} onNao={apagarTudo}>
      {itens.map(item => (
        <div key={item.id} className="flex items-center justify-between rounded-lg border border-edge bg-base px-3 py-2">
          <div>
            <p className="text-sm font-medium text-ink">{item.produto_nome}</p>
            <p className="text-xs text-ink-muted">{MOTIVO_LABEL[item.motivo]}</p>
          </div>
          {!disabled && (
            <button onClick={() => remover(item.id)} className="text-ink-faint hover:text-alert transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}

      {!disabled && (
        <div className="space-y-2 pt-1">
          <input
            type="text" value={produto} onChange={e => setProduto(e.target.value)}
            placeholder="Nome do produto"
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-ember focus:outline-none"
          />
          <select
            value={motivo} onChange={e => setMotivo(e.target.value as Op86Motivo | '')}
            className="w-full rounded-lg border border-edge bg-base px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none"
          >
            <option value="">Motivo…</option>
            {OP_86_MOTIVOS.map(m => (
              <option key={m} value={m}>{MOTIVO_LABEL[m]}</option>
            ))}
          </select>
          {erro && <p className="text-xs text-alert-bright">{erro}</p>}
          <button
            onClick={adicionar} disabled={salvando}
            className="w-full rounded-lg bg-surface-raised border border-edge px-3 py-2 text-sm font-medium text-ink hover:bg-surface transition-colors disabled:opacity-50"
          >
            {salvando ? 'Adicionando…' : '+ Adicionar item 86'}
          </button>
        </div>
      )}
    </RegistroColapsavel>
  )
}
