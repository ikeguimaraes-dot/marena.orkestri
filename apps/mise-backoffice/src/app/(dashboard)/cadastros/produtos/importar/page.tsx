import { ImportarProdutosForm } from './_components/importar-produtos-form'

export default function ImportarProdutosPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Importar Produtos</h1>
        <p className="text-sm text-ink-muted">Sincronizar catálogo a partir da planilha Everest</p>
      </div>

      <div className="max-w-2xl rounded-xl border border-edge bg-surface p-5 text-sm text-ink-muted space-y-2">
        <p>
          Envie a planilha Everest (<span className="text-ink">.xlsx</span> ou{' '}
          <span className="text-ink">.csv</span>) com as colunas{' '}
          <strong className="text-ink">Item</strong>, <strong className="text-ink">Descrição do Item</strong>,{' '}
          <strong className="text-ink">UM</strong> e <strong className="text-ink">Grande Grupo</strong>.
        </p>
        <p>
          A sincronização é feita pelo código do item (<em>Item</em>): produtos já cadastrados são{' '}
          <strong className="text-ink">atualizados</strong> (nome, unidade e grupo) e produtos novos são{' '}
          <strong className="text-ink">inseridos</strong>. Produtos que existem no MISE mas não aparecem na
          planilha <strong className="text-ink">não são apagados nem inativados</strong> — permanecem como estão.
        </p>
      </div>

      <ImportarProdutosForm />
    </div>
  )
}
