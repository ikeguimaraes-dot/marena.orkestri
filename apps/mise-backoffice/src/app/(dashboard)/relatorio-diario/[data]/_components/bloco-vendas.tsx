'use client'
import { moedaParaExibicao, moedaAoDigitar } from '@/lib/utils'

// Campo de moeda com máscara "caixa eletrônico": os dígitos entram
// pela direita e a vírgula fica sempre travada em 2 casas. O valor
// exibido é derivado direto do estado, então não precisa de texto local.
function CampoMoeda({
  id, valor, onChange, disabled, erro,
}: {
  id: string
  valor: string
  onChange: (estado: string) => void
  disabled?: boolean
  erro?: boolean
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={moedaParaExibicao(valor)}
      onChange={e => onChange(moedaAoDigitar(e.target.value).estado)}
      disabled={disabled}
      placeholder="0,00"
      className={`w-full rounded-lg border bg-base px-3 py-2 text-sm text-ink text-right placeholder:text-ink-faint focus:outline-none disabled:opacity-50 ${
        erro ? 'border-alert focus:border-alert' : 'border-edge focus:border-ember'
      }`}
    />
  )
}

export type VendasState = {
  vendas_ab: string
  alimentos: string      // mantido no state (não removido do banco), só sai do formulário
  bebidas: string
  taxa_servico: string
  desconto: string
  delivery: string
  portaria_valor: string
  pax_total: string
  perda_produto: string
}

function num(v: string): number { return parseFloat(v) || 0 }
function pct(v: number): string { return isNaN(v) || !isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%` }
function brl(v: number): string { return isNaN(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export function BlocoVendas({
  value,
  onChange,
  disabled,
  erros,
}: {
  value: VendasState
  onChange: (v: VendasState) => void
  disabled?: boolean
  erros?: { vendas_ab?: boolean; pax_total?: boolean; taxa_servico?: boolean; desconto?: boolean; delivery?: boolean; portaria_valor?: boolean; perda_produto?: boolean }
}) {
  const vendas_ab = num(value.vendas_ab)
  const taxa_servico = num(value.taxa_servico)
  const desconto = num(value.desconto)
  const delivery = num(value.delivery)
  const portaria_valor = num(value.portaria_valor)
  const pax_total = num(value.pax_total)
  const perda_produto = num(value.perda_produto)

  const faturamento_bruto = vendas_ab + taxa_servico + delivery + portaria_valor
  const ticket_medio = pax_total > 0 ? (vendas_ab + desconto) / pax_total : NaN
  const perda_pct = faturamento_bruto > 0 ? perda_produto / faturamento_bruto : NaN
  const tx_gorjeta = vendas_ab > 0 ? taxa_servico / vendas_ab : NaN

  function field(
    key: keyof VendasState,
    label: string,
    opts: { prefix?: string; integer?: boolean; required?: boolean; erro?: boolean } = {}
  ) {
    const isMoeda = !opts.integer
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-ink-muted">
          {label}{opts.required && <span className="text-ember ml-0.5">*</span>}
        </label>
        {isMoeda ? (
          <CampoMoeda
            id={key}
            valor={value[key]}
            onChange={estado => onChange({ ...value, [key]: estado })}
            disabled={disabled}
            erro={opts.erro}
          />
        ) : (
          <div className="relative">
            {opts.prefix && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">{opts.prefix}</span>
            )}
            <input
              id={key}
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={value[key]}
              onChange={e => onChange({ ...value, [key]: e.target.value })}
              disabled={disabled}
              className={`w-full rounded-lg border bg-base px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50 ${
                opts.prefix ? 'pl-7' : ''
              } ${
                opts.erro ? 'border-alert focus:border-alert' : 'border-edge focus:border-ember'
              }`}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-edge bg-surface p-5 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Vendas</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {field('vendas_ab', 'Valor de A&B Produtos', { required: true, erro: erros?.vendas_ab })}
        {field('pax_total', 'PAX Total', { integer: true, required: true, erro: erros?.pax_total })}
        {field('taxa_servico', 'Gorjeta', { required: true, erro: erros?.taxa_servico })}
        {field('desconto', 'Desconto', { erro: erros?.desconto })}
        {field('delivery', 'Delivery', { required: true, erro: erros?.delivery })}
        {field('portaria_valor', 'Portaria (valor)', { required: true, erro: erros?.portaria_valor })}
        {field('perda_produto', 'Perda de Produto', { required: true, erro: erros?.perda_produto })}
      </div>

      {/* Fechamento calculado — read-only */}
      <div className="rounded-lg border border-edge/50 bg-base p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Fechamento</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <span className="text-ink-muted">Faturamento bruto</span>
          <span className="text-ink text-right font-medium">{brl(faturamento_bruto)}</span>

          <span className="text-ink-muted">Ticket médio</span>
          <span className="text-ink text-right font-medium">{brl(ticket_medio)}</span>

          <span className="text-ink-muted">Taxa de Perda</span>
          <span className="text-ink text-right font-medium">{pct(perda_pct)}</span>

          <span className="text-ink-muted">Taxa de Gorjeta</span>
          <span className="text-ink text-right font-medium">{pct(tx_gorjeta)}</span>
        </div>
      </div>
    </div>
  )
}
