import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMiseSession } from '@/lib/session'
import { MiseWorkspace } from '@/components/mise/workspace'
import {
  Tag, Clock, PackageCheck, ChefHat, ClipboardList,
  ClipboardCheck, FileText, BookOpen, LayoutDashboard,
} from 'lucide-react'

type Frente = {
  href: string
  nome: string
  descricao: string
  icon: React.ElementType
  soGestor?: boolean
}

const FRENTES: Frente[] = [
  { href: '/etiquetas', nome: 'Etiquetas', descricao: 'Impressão e controle de etiquetas de manipulação', icon: Tag },
  { href: '/validades', nome: 'Validades', descricao: 'Acompanhe o que está próximo do vencimento', icon: Clock },
  { href: '/recebimento', nome: 'Recebimento', descricao: 'Conferência e entrada de mercadorias', icon: PackageCheck },
  { href: '/producao', nome: 'Produção', descricao: 'Registro e planejamento das produções do dia', icon: ChefHat },
  { href: '/inventario', nome: 'Inventário', descricao: 'Contagem e controle de estoque', icon: ClipboardList },
  { href: '/checklists', nome: 'Checklists', descricao: 'Rotinas e conferências operacionais', icon: ClipboardCheck },
  { href: '/relatorio-diario', nome: 'Resumo Operacional', descricao: 'Fechamento de turno e indicadores da operação', icon: BookOpen },
  { href: '/relatorios', nome: 'Relatórios', descricao: 'Histórico de produção e consolidados', icon: FileText, soGestor: true },
  { href: '/painel', nome: 'Dashboard', descricao: 'Visão geral do dia em números', icon: LayoutDashboard, soGestor: true },
]

export default async function HomePage() {
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <MiseWorkspace />
  }
  const session = await getMiseSession()
  if (!session) redirect('/pin-login')

  const isGestor = session.role !== 'cozinheiro'
  const frentes = FRENTES.filter(f => !f.soGestor || isGestor)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <div className="eyebrow mb-3"><span className="status-dot" /> CUIDADO EM CADA ETAPA</div>
        <h1 className="text-3xl font-medium tracking-tight text-ink">Tudo começa com um bom preparo.</h1>
        <p className="mt-3 text-sm text-ink-muted">Sua cozinha em ordem. Escolha por onde começar.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {frentes.map(({ href, nome, descricao, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-xl border border-edge bg-surface p-5 transition-colors hover:border-ember hover:bg-surface-raised"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-ember-soft text-ember transition-colors group-hover:bg-ember group-hover:text-ember-ink">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink">{nome}</h2>
              <p className="mt-0.5 text-sm text-ink-muted">{descricao}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
