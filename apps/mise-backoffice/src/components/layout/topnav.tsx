'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChefHat,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  HelpCircle,
  History,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  Printer,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const mainLinks = [
  { href: '/etiquetas', hash: 'etiquetas', label: 'Etiquetas', icon: Printer },
  {
    href: '/checklists',
    hash: 'checklists',
    label: 'Checklists',
    icon: ClipboardCheck,
  },
  {
    href: '/validades',
    hash: 'validades',
    label: 'Validades próximas',
    icon: Clock3,
  },
  {
    href: '/etiquetas#historico',
    hash: 'historico',
    label: 'Histórico de impressão',
    icon: History,
  },
]
const moreLinks = [
  { href: '/painel', label: 'Visão geral', icon: LayoutGrid },
  { href: '/cadastros/produtos', label: 'Produtos e preparos', icon: Package },
  { href: '/recebimento', label: 'Recebimento', icon: Package },
  { href: '/producao', label: 'Produção', icon: ChefHat },
  { href: '/inventario', label: 'Inventário', icon: ClipboardCheck },
  { href: '/relatorio-diario', label: 'Resumo operacional', icon: BookOpen },
  { href: '/relatorios', label: 'Relatórios', icon: BookOpen },
  { href: '/cadastros/funcionarios', label: 'Equipe', icon: Users },
  { href: '/cadastros/responsaveis', label: 'Responsáveis', icon: Users },
  { href: '/cadastros/grupos', label: 'Grupos de produtos', icon: Package },
  {
    href: '/checklists/historico',
    label: 'Histórico de checklists',
    icon: History,
  },
  {
    href: '/configuracoes/pontos-impressao',
    label: 'Impressoras',
    icon: Printer,
  },
  { href: '/configuracoes/pins', label: 'PINs de acesso', icon: Settings2 },
  { href: '/crivo', label: 'Auditorias Crivo', icon: ShieldCheck },
  { href: '/alertas', label: 'Alertas', icon: Bell },
]

export function MiseMark() {
  return (
    <span className="mise-wordmark">
      mise<span className="mise-wordmark-dot">.</span>
    </span>
  )
}

export function TopNav({
  role = 'admin',
  isPinUser = false,
  demo = false,
  employeeName = 'Minha conta',
}: {
  role?: 'admin' | 'gerente' | 'cozinheiro'
  isPinUser?: boolean
  hasChecklists?: boolean
  demo?: boolean
  employeeName?: string
}) {
  const NavLink = demo ? 'a' : Link
  const pathname = usePathname()
  const router = useRouter()
  const [active, setActive] = useState('etiquetas')
  const [expiryCount, setExpiryCount] = useState(4)
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [panel, setPanel] = useState<'help' | 'settings' | 'account' | null>(
    null,
  )
  const [signOutError, setSignOutError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const drawerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const updateCount = (event: Event) =>
      setExpiryCount((event as CustomEvent<number>).detail)
    window.addEventListener('mise-demo-expiry', updateCount)
    const update = () => setActive(window.location.hash.slice(1) || 'etiquetas')
    update()
    window.addEventListener('hashchange', update)
    return () => {
      window.removeEventListener('hashchange', update)
      window.removeEventListener('mise-demo-expiry', updateCount)
    }
  }, [])
  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed
      ? 'compact'
      : 'expanded'
    return () => {
      delete document.documentElement.dataset.sidebar
    }
  }, [collapsed])
  useEffect(() => {
    if (panel) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [panel])
  useEffect(() => {
    if (!drawer) return
    const original = document.body.style.overflow
    const previous = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector<HTMLElement>('button, a')?.focus()
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawer(false)
      if (event.key === 'Tab') {
        const targets = Array.from(
          drawerRef.current?.querySelectorAll<HTMLElement>('a, button') ?? [],
        ).filter((el) => el.getClientRects().length)
        const first = targets[0],
          last = targets[targets.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener('keydown', close)
    return () => {
      document.body.style.overflow = original
      window.removeEventListener('keydown', close)
      previous?.focus()
    }
  }, [drawer])

  async function signOut() {
    setSignOutError('')
    try {
      if (isPinUser) {
        const response = await fetch('/api/auth/pin-logout', { method: 'POST' })
        if (!response.ok) throw new Error('Falha ao sair')
      } else {
        const { error } = await createClient().auth.signOut()
        if (error) throw error
      }
      router.push(isPinUser ? '/pin-login' : '/login')
      router.refresh()
    } catch {
      setSignOutError('Não foi possível sair. Tente novamente.')
    }
  }

  const management = moreLinks
    .filter(
      (item) => !['/crivo', '/alertas'].includes(item.href) || role === 'admin',
    )
    .filter(
      (item) =>
        role !== 'cozinheiro' ||
        [
          '/recebimento',
          '/producao',
          '/inventario',
          '/relatorio-diario',
          '/checklists/historico',
        ].includes(item.href),
    )
  const navContent = (
    <>
      <div className="sidebar-brand">
        <NavLink href="/" aria-label="Mise, início">
          <MiseMark />
        </NavLink>
        <button
          className="icon-button collapse-button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <PanelLeftClose size={17} />
        </button>
        <button
          className="icon-button drawer-close"
          onClick={() => setDrawer(false)}
          aria-label="Fechar menu"
        >
          <X size={20} />
        </button>
      </div>
      <button className="workspace-select" onClick={() => setPanel('account')}>
        <span className="workspace-avatar">
          <ChefHat size={19} />
        </span>
        <span className="sidebar-text">
          <strong>{demo ? 'Cozinha principal' : 'Minha operação'}</strong>
          <small>
            {demo ? 'Workspace de demonstração' : 'Seu espaço de trabalho'}
          </small>
        </span>
        <ChevronDown size={14} className="sidebar-text" />
      </button>
      <div className="sidebar-section-label sidebar-text">OPERAÇÃO</div>
      <nav className="primary-navigation" aria-label="Navegação principal">
        {mainLinks.map(({ href, hash, label, icon: Icon }) => {
          const selected = demo
            ? active === hash
            : hash === 'historico'
              ? pathname === '/etiquetas' && active === 'historico'
              : (pathname === href ||
                  pathname.startsWith(href + '/') ||
                  (pathname === '/' && hash === 'etiquetas')) &&
                active !== 'historico'
          return (
            <NavLink
              key={hash}
              href={demo ? `/#${hash}` : href}
              title={label}
              aria-current={selected ? 'page' : undefined}
              className={`sidebar-link ${selected ? 'is-active' : ''}`}
              onClick={() => {
                setActive(hash)
                setDrawer(false)
              }}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span className="sidebar-text">{label}</span>
              {demo && hash === 'validades' && (
                <span className="nav-count sidebar-text">{expiryCount}</span>
              )}
            </NavLink>
          )
        })}
      </nav>
      <div className="sidebar-section-label sidebar-text">GESTÃO</div>
      <nav className="secondary-navigation" aria-label="Gestão">
        {management
          .slice(0, demo ? 2 : 6)
          .map(({ href, label, icon: Icon }, index) => (
            <NavLink
              className={`sidebar-link ${pathname === href ? 'is-active' : ''}`}
              key={href}
              href={
                demo ? (index === 0 ? '/#visao-geral' : '/#produtos') : href
              }
              onClick={() => setDrawer(false)}
              title={label}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span className="sidebar-text">{label}</span>
            </NavLink>
          ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="kitchen-note sidebar-text">
          <span className="note-symbol">✳</span>
          <p>
            Uma cozinha em ordem.
            <br />
            <strong>Espaço para criar.</strong>
          </p>
          <span>O cuidado começa no preparo.</span>
        </div>
        <button
          className="sidebar-link"
          onClick={() => setPanel('settings')}
          title="Configurações"
        >
          <Settings2 size={18} />
          <span className="sidebar-text">Configurações</span>
        </button>
        <button
          className="sidebar-link"
          onClick={() => setPanel('help')}
          title="Ajuda e atalhos"
        >
          <HelpCircle size={18} />
          <span className="sidebar-text">Ajuda e atalhos</span>
          <ArrowUpRight size={14} className="sidebar-text" />
        </button>
        <button className="sidebar-profile" onClick={() => setPanel('account')}>
          <span className="person-avatar">
            {demo
              ? 'AC'
              : employeeName
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')}
          </span>
          <span className="sidebar-text">
            <strong>{demo ? 'Ana Costa' : employeeName}</strong>
            <small>
              {role === 'cozinheiro'
                ? 'Equipe de cozinha'
                : 'Gestão de cozinha'}
            </small>
          </span>
          <ChevronDown size={14} className="sidebar-text" />
        </button>
      </div>
    </>
  )

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      <aside className={`mise-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
        {navContent}
      </aside>
      <div className="mobile-topbar">
        <NavLink href="/" aria-label="Mise, início">
          <MiseMark />
        </NavLink>
        <span>
          <i className="status-dot" />
          {demo ? 'Demonstração' : 'Sua operação'}
        </span>
        <button
          className="icon-button"
          aria-label="Abrir menu"
          aria-expanded={drawer}
          onClick={() => setDrawer(true)}
        >
          <Menu size={22} />
        </button>
      </div>
      <AnimatePresence>
        {drawer && (
          <motion.div
            className="mobile-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawer(false)}
          >
            <motion.aside
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navegação"
              className="mobile-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
            >
              {navContent}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <nav className="mobile-bottom-nav" aria-label="Navegação mobile">
        {mainLinks.map(({ hash, href, label, icon: Icon }) => (
          <NavLink
            key={hash}
            href={demo ? `/#${hash}` : href}
            onClick={() => setActive(hash)}
            className={
              (
                demo
                  ? active === hash
                  : pathname === href && hash !== 'historico'
              )
                ? 'is-active'
                : ''
            }
          >
            <Icon size={21} />
            <span>
              {hash === 'historico'
                ? 'Histórico'
                : hash === 'validades'
                  ? 'Validades'
                  : label}
            </span>
          </NavLink>
        ))}
      </nav>
      <dialog
        ref={dialogRef}
        aria-labelledby="mise-navigation-dialog-title"
        className="mise-dialog"
        onCancel={() => setPanel(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPanel(null)
        }}
      >
        <div className="dialog-heading">
          <h2 id="mise-navigation-dialog-title">
            {panel === 'help'
              ? 'Tudo no seu lugar.'
              : panel === 'settings'
                ? 'Sua operação, do seu jeito.'
                : 'Seu espaço de trabalho'}
          </h2>
          <button
            className="icon-button"
            aria-label="Fechar"
            onClick={() => setPanel(null)}
          >
            <X size={20} />
          </button>
        </div>
        {panel === 'help' && (
          <div className="help-content">
            <p>
              Selecione um preparo, confira os dados e imprima. Use os
              checklists para acompanhar cada etapa do turno.
            </p>
            <div>
              <Search size={18} />
              <span>Buscar um preparo</span>
              <kbd>⌘ K</kbd>
            </div>
            <div>
              <Check size={18} />
              <span>Marcar uma tarefa</span>
              <kbd>Espaço</kbd>
            </div>
            <div>
              <X size={18} />
              <span>Fechar uma janela</span>
              <kbd>Esc</kbd>
            </div>
            {demo && (
              <p className="demo-explanation">
                Esta é uma demonstração interativa. Produtos, prazos e tarefas
                são exemplos; nenhuma etiqueta é enviada à impressora.
              </p>
            )}
          </div>
        )}
        {panel === 'settings' && (
          <div className="settings-links">
            {demo ? (
              <>
                <p>
                  A prévia usa uma cozinha de demonstração. Na operação
                  conectada, gerencie impressoras, equipe e produtos por aqui.
                </p>
                <button
                  className="mise-primary-button"
                  onClick={() => {
                    setPanel(null)
                    window.location.hash = 'produtos'
                  }}
                >
                  Explorar produtos <ArrowUpRight size={16} />
                </button>
              </>
            ) : (
              management.map(({ href, label, icon: Icon }) => (
                <NavLink
                  key={href}
                  href={href}
                  onClick={() => {
                    setPanel(null)
                    setDrawer(false)
                  }}
                >
                  <Icon size={18} />
                  {label}
                  <ArrowUpRight size={15} />
                </NavLink>
              ))
            )}
          </div>
        )}
        {panel === 'account' && (
          <div className="help-content">
            <span className="person-avatar large">
              {demo ? 'AC' : employeeName.slice(0, 2).toUpperCase()}
            </span>
            <h3>{demo ? 'Ana Costa' : employeeName}</h3>
            <p>
              {demo
                ? 'Cozinha principal · Ambiente de demonstração'
                : 'Conta conectada à operação Mise'}
            </p>
            {demo ? (
              <p className="demo-explanation">
                Explore os fluxos livremente. As alterações ficam apenas nesta
                sessão de demonstração.
              </p>
            ) : (
              <button className="mise-secondary-button" onClick={signOut}>
                <LogOut size={17} /> Sair da conta
              </button>
            )}
            {signOutError && <p role="alert">{signOutError}</p>}
          </div>
        )}
      </dialog>
    </MotionConfig>
  )
}
