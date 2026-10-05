'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChefHat,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  History,
  Leaf,
  LoaderCircle,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Star,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { MiseMark } from '@/components/layout/topnav'

type Product = {
  id: string
  name: string
  category: string
  days: number
  image: string
  detail: string
  favorite: boolean
}
type PrintRecord = {
  id: string
  name: string
  quantity: number
  date: string
  expiry: string
  storage: string
}
type Task = {
  id: number
  name: string
  detail: string
  done: boolean
  tag?: string
}
const initialProducts: Product[] = [
  {
    id: 'tomate',
    name: 'Massa de tomate',
    category: 'Molhos e bases',
    days: 3,
    image: 'tomatoes',
    detail: 'Base da casa',
    favorite: true,
  },
  {
    id: 'pesto',
    name: 'Molho pesto',
    category: 'Molhos e bases',
    days: 3,
    image: 'pesto',
    detail: 'Manjericão fresco',
    favorite: true,
  },
  {
    id: 'wagyu',
    name: 'Sous-vide Wagyu',
    category: 'Proteínas',
    days: 2,
    image: 'wagyu',
    detail: 'Porcionado · 200 g',
    favorite: true,
  },
  {
    id: 'legumes',
    name: 'Legumes assados',
    category: 'Preparos',
    days: 3,
    image: 'carrots',
    detail: 'Seleção da estação',
    favorite: false,
  },
  {
    id: 'focaccia',
    name: 'Massa de focaccia',
    category: 'Preparos',
    days: 2,
    image: 'bread',
    detail: 'Fermentação natural',
    favorite: true,
  },
  {
    id: 'cogumelos',
    name: 'Duxelles de cogumelos',
    category: 'Preparos',
    days: 2,
    image: 'mushrooms',
    detail: 'Shiitake e Paris',
    favorite: false,
  },
]
const initialTasks: Record<string, Task[]> = {
  Abertura: [
    {
      id: 1,
      name: 'Higienizar bancadas e utensílios',
      detail: 'Cozinha principal',
      done: true,
    },
    {
      id: 2,
      name: 'Conferir temperaturas das câmaras',
      detail: 'Câmaras 01 e 02',
      done: true,
    },
    {
      id: 3,
      name: 'Verificar validades dos preparos',
      detail: 'Priorizar os que vencem hoje',
      done: false,
      tag: 'Prioridade',
    },
    {
      id: 4,
      name: 'Organizar o mise en place',
      detail: 'Todas as praças',
      done: false,
    },
  ],
  'Praça de carnes': [
    {
      id: 5,
      name: 'Conferir porcionamento das proteínas',
      detail: 'Praça de carnes',
      done: false,
    },
    {
      id: 6,
      name: 'Separar utensílios por preparo',
      detail: 'Prevenção de contaminação cruzada',
      done: true,
    },
    {
      id: 7,
      name: 'Etiquetar todos os cortes',
      detail: 'Conferir lote e responsável',
      done: false,
    },
  ],
  Fechamento: [
    {
      id: 8,
      name: 'Armazenar e etiquetar os preparos',
      detail: 'Todas as praças',
      done: false,
    },
    {
      id: 9,
      name: 'Higienizar equipamentos',
      detail: 'Seguir o procedimento da cozinha',
      done: false,
    },
    {
      id: 10,
      name: 'Conferir portas das câmaras',
      detail: 'Última conferência do turno',
      done: false,
    },
  ],
}
const initialExpiry = [
  {
    id: 1,
    name: 'Creme de ricota',
    batch: 'LT-0421',
    time: 'Vencido há 2 h',
    state: 'expired',
    image: 'bread',
    quantity: '2 recipientes',
  },
  {
    id: 2,
    name: 'Molho pesto',
    batch: 'LT-0422',
    time: 'Vence hoje',
    state: 'today',
    image: 'pesto',
    quantity: '3 recipientes',
  },
  {
    id: 3,
    name: 'Sous-vide Wagyu',
    batch: 'LT-0423',
    time: 'Vence hoje',
    state: 'today',
    image: 'wagyu',
    quantity: '6 porções',
  },
  {
    id: 4,
    name: 'Legumes assados',
    batch: 'LT-0424',
    time: 'Vence amanhã',
    state: 'tomorrow',
    image: 'carrots',
    quantity: '2 recipientes',
  },
]
const categories = [
  'Todos',
  'Favoritos',
  'Molhos e bases',
  'Proteínas',
  'Preparos',
]
const storageOptions = ['Refrigerado', 'Congelado', 'Ambiente']
const dayOffset = (value: string, days: number) => {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date
}
const localDate = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const formatDate = (date: Date) =>
  date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

export function MiseWorkspace() {
  const [view, setView] = useState('etiquetas')
  const [products, setProducts] = useState(initialProducts)
  const [selectedId, setSelectedId] = useState('tomate')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todos')
  const [storage, setStorage] = useState('Refrigerado')
  const [prepDate, setPrepDate] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [printing, setPrinting] = useState(false)
  const [printSuccess, setPrintSuccess] = useState(false)
  const [records, setRecords] = useState<PrintRecord[]>([])
  const [tasks, setTasks] = useState(initialTasks)
  const [shift, setShift] = useState('Abertura')
  const [expiry, setExpiry] = useState(initialExpiry)
  const [expiryFilter, setExpiryFilter] = useState('Todos')
  const [toast, setToast] = useState('')
  const [dialog, setDialog] = useState<
    'new' | 'printer' | 'alerts' | 'product' | null
  >(null)
  const [sort, setSort] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('Preparos')
  const [newDays, setNewDays] = useState(3)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const labelPanelRef = useRef<HTMLElement>(null)
  const printTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selected = products.find((p) => p.id === selectedId) ?? products[0]
  // Illustrative rules belong only to this explicitly labelled development preview.
  const shelfDays =
    storage === 'Congelado' ? 30 : storage === 'Ambiente' ? 1 : selected.days
  const expiration = prepDate ? dayOffset(prepDate, shelfDays) : null
  const allTasks = Object.values(tasks).flat()
  const doneCount = allTasks.filter((t) => t.done).length
  const visibleTasks = tasks[shift]
  const shiftDone = visibleTasks.filter((t) => t.done).length
  const totalPrinted = records.reduce((sum, r) => sum + r.quantity, 0)
  const filtered = products
    .filter((p) =>
      p.name
        .toLocaleLowerCase('pt-BR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .includes(
          query
            .toLocaleLowerCase('pt-BR')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''),
        ),
    )
    .filter(
      (p) =>
        category === 'Todos' ||
        (category === 'Favoritos' ? p.favorite : p.category === category),
    )
    .sort((a, b) => (sort ? a.name.localeCompare(b.name) : 0))

  useEffect(() => {
    setPrepDate(localDate())
    setRecords((current) =>
      current.length
        ? current
        : initialProducts.map((product, index) => ({
            id: `LT-${String(424 - index).padStart(4, '0')}`,
            name: product.name,
            quantity: 4,
            date: new Date(
              Date.now() - (index + 1) * 20 * 60 * 1000,
            ).toISOString(),
            expiry: dayOffset(localDate(), product.days).toISOString(),
            storage: 'Refrigerado',
          })),
    )
    const changeView = () => {
      const hash = window.location.hash.slice(1)
      setView(
        [
          'etiquetas',
          'checklists',
          'validades',
          'historico',
          'produtos',
          'visao-geral',
        ].includes(hash)
          ? hash
          : 'etiquetas',
      )
    }
    changeView()
    window.addEventListener('hashchange', changeView)
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        window.location.hash = 'etiquetas'
        requestAnimationFrame(() => searchRef.current?.focus())
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => {
      window.removeEventListener('hashchange', changeView)
      window.removeEventListener('keydown', shortcut)
      if (printTimer.current) clearTimeout(printTimer.current)
    }
  }, [])
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('mise-demo-expiry', { detail: expiry.length }),
    )
  }, [expiry])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4500)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (dialog) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [dialog])

  function printLabel() {
    if (
      printing ||
      !prepDate ||
      !expiration ||
      Number.isNaN(expiration.getTime())
    )
      return
    setPrinting(true)
    setPrintSuccess(false)
    const record = {
      id: `LT-${String(425 + Math.max(0, records.length - initialProducts.length)).padStart(4, '0')}`,
      name: selected.name,
      quantity,
      date: new Date().toISOString(),
      expiry: expiration.toISOString(),
      storage,
    }
    printTimer.current = setTimeout(() => {
      setRecords((current) => [record, ...current])
      setPrinting(false)
      setPrintSuccess(true)
      setToast(
        `${quantity === 1 ? 'Etiqueta simulada' : `${quantity} etiquetas simuladas`}. Confira no histórico.`,
      )
      printTimer.current = setTimeout(() => setPrintSuccess(false), 2400)
    }, 1000)
  }
  function toggleTask(id: number) {
    setTasks((current) => ({
      ...current,
      [shift]: current[shift].map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    }))
  }
  function exportHistory() {
    if (!records.length) {
      setToast('Simule uma impressão para começar seu histórico.')
      return
    }
    const escape = (text: string) => `"${text.replace(/"/g, '""')}"`
    const csv =
      '\uFEFF' +
      [
        ['Lote', 'Produto', 'Quantidade', 'Data', 'Validade', 'Conservação'],
        ...records.map((r) => [
          r.id,
          r.name,
          String(r.quantity),
          new Date(r.date).toLocaleString('pt-BR'),
          formatDate(new Date(r.expiry)),
          r.storage,
        ]),
      ]
        .map((row) => row.map(escape).join(';'))
        .join('\r\n')
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'mise-historico-demonstracao.csv'
    a.click()
    URL.revokeObjectURL(url)
    setToast('Histórico exportado.')
  }
  const title = (
    {
      etiquetas: 'Etiquetas',
      checklists: 'Checklists',
      validades: 'Validades próximas',
      historico: 'Histórico de impressão',
      produtos: 'Produtos e preparos',
      'visao-geral': 'Visão geral',
    } as Record<string, string>
  )[view]

  const checklistPanel = (
    <section
      className={`glass-panel checklist-panel ${view === 'checklists' ? 'full-checklist' : ''}`}
    >
      <div className="panel-heading">
        <div className="heading-with-icon">
          <span className="panel-icon">
            <ClipboardCheck size={18} />
          </span>
          <h2>O ritmo da cozinha</h2>
        </div>
        <span className="subtle-label">
          {doneCount}/{allTasks.length} tarefas
        </span>
      </div>
      <div className="checklist-subheading">
        <p>Pequenos cuidados. Um grande serviço.</p>
        {view !== 'checklists' && (
          <a href="#checklists" aria-label="Ver todos os checklists">
            <ArrowUpRight size={17} />
          </a>
        )}
      </div>
      <div className="shift-tabs" role="tablist" aria-label="Turnos">
        {Object.keys(tasks).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={shift === s}
            onClick={() => setShift(s)}
            className={shift === s ? 'active' : ''}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="shift-progress">
        <span>{shift === 'Abertura' ? 'Abertura de cozinha' : shift}</span>
        <strong>
          {shiftDone} de {visibleTasks.length}
        </strong>
      </div>
      <div className="progress-track">
        <motion.div
          animate={{ width: `${(shiftDone / visibleTasks.length) * 100}%` }}
          transition={{ duration: 0.35 }}
        />
      </div>
      <div className="task-list" role="tabpanel" aria-label={shift}>
        {visibleTasks.map((task) => (
          <motion.button
            layout
            key={task.id}
            onClick={() => toggleTask(task.id)}
            role="checkbox"
            aria-checked={task.done}
            className={`task-row ${task.done ? 'completed' : ''}`}
            whileTap={{ scale: 0.987 }}
          >
            <span className="task-check">
              <AnimatePresence>
                {task.done && (
                  <motion.span
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.2, opacity: 0 }}
                  >
                    <Check size={13} strokeWidth={3} />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <span className="task-copy">
              <strong>{task.name}</strong>
              <small>{task.detail}</small>
            </span>
            {task.tag && !task.done && (
              <span className="task-tag">{task.tag}</span>
            )}
          </motion.button>
        ))}
      </div>
      <div className="checklist-footer">
        <span className="tiny-avatar">AC</span>
        <span>
          {shiftDone === visibleTasks.length
            ? 'Tudo pronto. Bom serviço!'
            : 'Cada detalhe faz a diferença.'}
        </span>
        {shiftDone === visibleTasks.length ? (
          <CheckCheck size={17} />
        ) : (
          <Leaf size={16} />
        )}
      </div>
    </section>
  )

  const expiryPanel = (
    <section className="glass-panel expiry-panel">
      <div className="panel-heading">
        <div className="heading-with-icon">
          <span className="panel-icon amber">
            <Clock3 size={18} />
          </span>
          <h2>Primeiro, estes preparos</h2>
        </div>
        <a href="#validades" className="text-link">
          Ver todos <ArrowRight size={14} />
        </a>
      </div>
      <p className="panel-description">
        O próximo a vencer é o primeiro a sair.
      </p>
      <div className="expiry-mini-list">
        {expiry.slice(0, 3).map((item) => (
          <button
            key={item.id}
            className="expiry-mini-row"
            onClick={() => {
              window.location.hash = 'validades'
            }}
          >
            <span className={`expiry-marker ${item.state}`} />
            <span>
              <strong>{item.name}</strong>
              <small>
                {item.quantity} · {item.batch}
              </small>
            </span>
            <span className={`status-pill ${item.state}`}>{item.time}</span>
            <ChevronRight size={14} />
          </button>
        ))}
        {expiry.length === 0 && (
          <div className="empty-state compact">
            <ShieldCheck size={25} />
            <p>Todas as pendências resolvidas.</p>
          </div>
        )}
      </div>
    </section>
  )

  return (
    <MotionConfig reducedMotion="user">
      <div className="mise-workspace">
        <header className="workspace-topbar">
          <div className="breadcrumb">
            <ChefHat size={16} />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-badge">
              <span />
              Demonstração
            </span>
            <span className="topbar-date">
              <CalendarDays size={15} />
              {prepDate
                ? dayOffset(prepDate, 0)
                    .toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      month: 'short',
                    })
                    .replace('.', '')
                : 'Hoje'}
            </span>
            <button
              className="icon-button notification-button"
              aria-label="Ver notificações"
              onClick={() => setDialog('alerts')}
            >
              <Bell size={18} />
              {expiry.length > 0 && <i />}
            </button>
          </div>
        </header>
        <div className="workspace-content">
          <section className="page-intro">
            <div>
              <div className="eyebrow">
                <span className="status-dot" /> CUIDADO EM CADA ETAPA
              </div>
              <h1>
                {view === 'etiquetas' ? (
                  <>
                    Tudo começa com
                    <br className="mobile-break" /> um bom preparo<span>.</span>
                  </>
                ) : (
                  title
                )}
                <span className="intro-sparkle">✳</span>
              </h1>
              <p>
                {view === 'etiquetas'
                  ? 'Mais cuidado com os alimentos. Mais leveza na sua rotina.'
                  : view === 'checklists'
                    ? 'Uma etapa de cada vez. Uma cozinha pronta para o serviço.'
                    : view === 'validades'
                      ? 'Antecipe o cuidado. Reduza perdas. Sirva sempre o melhor.'
                      : view === 'historico'
                        ? 'Cada preparo tem uma história. Aqui, você acompanha todas.'
                        : view === 'produtos'
                          ? 'Os ingredientes de uma operação bem cuidada.'
                          : 'Sua cozinha, em um olhar.'}
              </p>
            </div>
            <button
              className="mise-secondary-button printer-status"
              aria-label="Configurar impressora de prévia"
              onClick={() => setDialog('printer')}
            >
              <Printer size={16} />
              <span>Impressora de prévia</span>
              <i className="status-dot" />
              <ChevronDown size={13} />
            </button>
          </section>
          <section
            className="stats-grid"
            aria-label="Resumo da operação de demonstração"
          >
            <a href="#historico" className="stat-card">
              <span className="stat-icon green">
                <Printer size={18} />
              </span>
              <div>
                <span>Etiquetas hoje</span>
                <div className="stat-value">
                  {totalPrinted}
                  <small>
                    <span className="mini-bar-chart">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    preparos identificados
                  </small>
                </div>
              </div>
              <ArrowUpRight size={15} className="stat-arrow" />
            </a>
            <a href="#checklists" className="stat-card">
              <span className="stat-icon olive">
                <ClipboardCheck size={18} />
              </span>
              <div>
                <span>Checklists do dia</span>
                <div className="stat-value">
                  {doneCount}
                  <span className="stat-denominator">/{allTasks.length}</span>
                  <small>tarefas concluídas</small>
                </div>
              </div>
              <svg
                className="mini-ring"
                viewBox="0 0 40 40"
                aria-label={`${doneCount * 10}% concluído`}
              >
                <circle cx="20" cy="20" r="15" />
                <circle
                  cx="20"
                  cy="20"
                  r="15"
                  strokeDasharray={`${(doneCount / allTasks.length) * 94.25} 94.25`}
                />
              </svg>
            </a>
            <a href="#validades" className="stat-card">
              <span className="stat-icon amber">
                <Clock3 size={18} />
              </span>
              <div>
                <span>Vencem em breve</span>
                <div className="stat-value">
                  {expiry
                    .filter((e) => e.state !== 'expired')
                    .length.toString()
                    .padStart(2, '0')}
                  <small className="amber-text">nas próximas 48 horas</small>
                </div>
              </div>
              <ArrowUpRight size={15} className="stat-arrow" />
            </a>
            <a href="#validades" className="stat-card">
              <span className="stat-icon coral">
                <ShieldCheck size={18} />
              </span>
              <div>
                <span>Precisam de atenção</span>
                <div className="stat-value">
                  {expiry
                    .filter((e) => e.state === 'expired')
                    .length.toString()
                    .padStart(2, '0')}
                  <small className="coral-text">
                    {expiry.some((e) => e.state === 'expired')
                      ? 'preparo vencido'
                      : 'nenhum preparo vencido'}
                  </small>
                </div>
              </div>
              <ArrowUpRight size={15} className="stat-arrow" />
            </a>
          </section>

          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {(view === 'etiquetas' || view === 'produtos') && (
                <>
                  <div
                    className={`studio-layout ${view === 'produtos' ? 'catalog-view' : ''}`}
                  >
                    <section className="glass-panel product-panel">
                      <div className="panel-heading">
                        <div className="heading-with-icon">
                          <span className="panel-icon">
                            <Package size={19} />
                          </span>
                          <div>
                            <h2>
                              {view === 'produtos'
                                ? 'Seu catálogo'
                                : 'O que vamos preparar?'}
                            </h2>
                            <p>Selecione um produto para começar.</p>
                          </div>
                        </div>
                        <button
                          className="icon-button add-product"
                          aria-label="Adicionar produto"
                          onClick={() => setDialog('new')}
                        >
                          <Plus size={19} />
                        </button>
                      </div>
                      <div className="product-search">
                        <Search size={18} />
                        <input
                          ref={searchRef}
                          aria-label="Buscar produto ou preparo"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Buscar produto ou preparo..."
                        />
                        {query ? (
                          <button
                            className="icon-button"
                            aria-label="Limpar busca"
                            onClick={() => setQuery('')}
                          >
                            <X size={16} />
                          </button>
                        ) : (
                          <kbd>⌘ K</kbd>
                        )}
                        <button
                          className={`icon-button sort-button ${sort ? 'active' : ''}`}
                          aria-label="Ordenar produtos de A a Z"
                          aria-pressed={sort}
                          onClick={() => setSort(!sort)}
                        >
                          <SlidersHorizontal size={17} />
                        </button>
                      </div>
                      <div
                        className="product-filters"
                        aria-label="Filtrar produtos"
                      >
                        {categories.map((c) => (
                          <button
                            aria-pressed={category === c}
                            className={category === c ? 'active' : ''}
                            key={c}
                            onClick={() => setCategory(c)}
                          >
                            {c === 'Favoritos' && <Star size={12} />}
                            {c}
                          </button>
                        ))}
                      </div>
                      <div className="product-grid">
                        {filtered.map((product) => (
                          <div
                            key={product.id}
                            className={`product-card ${selectedId === product.id ? 'selected' : ''}`}
                          >
                            <button
                              className="product-select"
                              aria-pressed={selectedId === product.id}
                              onClick={() => {
                                setSelectedId(product.id)
                                setPrintSuccess(false)
                                if (view === 'produtos') setDialog('product')
                                else if (
                                  window.matchMedia('(max-width: 700px)')
                                    .matches
                                )
                                  labelPanelRef.current?.scrollIntoView({
                                    behavior: window.matchMedia(
                                      '(prefers-reduced-motion: reduce)',
                                    ).matches
                                      ? 'auto'
                                      : 'smooth',
                                    block: 'start',
                                  })
                              }}
                            >
                              <span
                                className={`product-image image-${product.image}`}
                              >
                                <img
                                  src={`/images/${product.image}.jpg`}
                                  alt=""
                                  width={68}
                                  height={68}
                                />
                              </span>
                              <strong>{product.name}</strong>
                              <span className="product-detail">
                                {product.detail}
                              </span>
                              <span className="product-meta">
                                <Snowflake size={12} />
                                Refrigerado<span>·</span>
                                {product.days} dias
                              </span>
                              {selectedId === product.id && (
                                <span className="selection-check">
                                  <Check size={11} strokeWidth={3} />
                                </span>
                              )}
                            </button>
                            <button
                              className={`favorite-button ${product.favorite ? 'is-favorite' : ''}`}
                              aria-label={`${product.favorite ? 'Remover' : 'Adicionar'} ${product.name} ${product.favorite ? 'dos' : 'aos'} favoritos`}
                              aria-pressed={product.favorite}
                              onClick={() =>
                                setProducts((current) =>
                                  current.map((p) =>
                                    p.id === product.id
                                      ? { ...p, favorite: !p.favorite }
                                      : p,
                                  ),
                                )
                              }
                            >
                              <Star
                                size={14}
                                fill={
                                  product.favorite ? 'currentColor' : 'none'
                                }
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                      {filtered.length === 0 && (
                        <div className="empty-state">
                          <Search size={30} />
                          <h3>Nenhum preparo por aqui.</h3>
                          <p>
                            Tente outro nome ou escolha uma categoria diferente.
                          </p>
                          <button
                            className="text-link"
                            onClick={() => {
                              setQuery('')
                              setCategory('Todos')
                            }}
                          >
                            Limpar filtros <ArrowRight size={14} />
                          </button>
                        </div>
                      )}
                      <div className="product-panel-footer">
                        <span>
                          {filtered.length} produtos{' '}
                          <span className="muted-dot">·</span> Feitos para sua
                          rotina
                        </span>
                        <button
                          className="text-link"
                          onClick={() => setDialog('new')}
                        >
                          Novo produto <Plus size={13} />
                        </button>
                      </div>
                    </section>
                    {view === 'etiquetas' && (
                      <section
                        ref={labelPanelRef}
                        className="glass-panel label-panel"
                      >
                        <div className="panel-heading">
                          <div className="heading-with-icon">
                            <span className="panel-icon">
                              <Printer size={18} />
                            </span>
                            <h2>Sua próxima etiqueta</h2>
                          </div>
                          <span className="live-label">
                            <span />
                            PRÉVIA AO VIVO
                          </span>
                        </div>
                        <div className="label-settings">
                          <label>Conservação</label>
                          <div
                            className="storage-options"
                            aria-label="Método de conservação"
                          >
                            {storageOptions.map((option, i) => {
                              const Icon = [Snowflake, Snowflake, Sun][i]
                              return (
                                <button
                                  key={option}
                                  aria-pressed={storage === option}
                                  className={storage === option ? 'active' : ''}
                                  onClick={() => setStorage(option)}
                                >
                                  <Icon size={13} />
                                  {option}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <div className="thermal-stage">
                          <div className="printer-slot" />
                          <motion.div
                            className={`thermal-label ${printing ? 'is-printing' : ''}`}
                            animate={printing ? { y: [0, 10, 0] } : { y: 0 }}
                            transition={{ duration: 0.7 }}
                          >
                            <div className="thermal-header">
                              <MiseMark />
                              <span>CONTROLE DE PREPARO</span>
                            </div>
                            <div className="thermal-product">
                              <h3>{selected.name}</h3>
                              <span>
                                {storage.toUpperCase()}{' '}
                                {storage === 'Refrigerado'
                                  ? '· 0 A 5 °C'
                                  : storage === 'Congelado'
                                    ? '· −18 °C'
                                    : ''}
                              </span>
                            </div>
                            <div className="thermal-dates">
                              <div>
                                <span>PREPARADO EM</span>
                                <strong>
                                  {prepDate
                                    ? formatDate(dayOffset(prepDate, 0))
                                    : '—'}
                                </strong>
                              </div>
                              <div className="expiry-date">
                                <span>VÁLIDO ATÉ</span>
                                <strong>
                                  {expiration ? formatDate(expiration) : '—'}
                                </strong>
                              </div>
                            </div>
                            <div className="thermal-bottom">
                              <div>
                                <span>
                                  RESPONSÁVEL <strong>ANA COSTA · AC01</strong>
                                </span>
                                <span>
                                  LOTE{' '}
                                  <strong>
                                    LT-
                                    {String(
                                      425 +
                                        Math.max(
                                          0,
                                          records.length -
                                            initialProducts.length,
                                        ),
                                    ).padStart(4, '0')}
                                  </strong>
                                </span>
                                <small>
                                  PRÉVIA · NÃO UTILIZAR EM ALIMENTOS
                                </small>
                              </div>
                              <QRCodeSVG
                                aria-label="Código QR da etiqueta de demonstração"
                                value={`MISE-DEMO|${selected.name}|${prepDate}|${expiration?.toISOString() ?? ''}|AC01|LT-${425 + Math.max(0, records.length - initialProducts.length)}`}
                                size={47}
                                level="L"
                              />
                            </div>
                          </motion.div>
                          <span className="label-size">
                            50 × 50 mm <span>·</span> Etiqueta térmica
                          </span>
                        </div>
                        <div className="print-controls">
                          <div className="prep-date-field">
                            <label htmlFor="prep-date">Data de preparo</label>
                            <div>
                              <CalendarDays size={14} />
                              <input
                                id="prep-date"
                                type="date"
                                value={prepDate}
                                max="2099-12-31"
                                min="2020-01-01"
                                required
                                onChange={(e) => setPrepDate(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="quantity-field">
                            <label>Quantidade</label>
                            <div className="quantity-stepper">
                              <button
                                aria-label="Diminuir quantidade"
                                disabled={quantity <= 1 || printing}
                                onClick={() =>
                                  setQuantity(Math.max(1, quantity - 1))
                                }
                              >
                                <Minus size={14} />
                              </button>
                              <output aria-live="polite">
                                {quantity.toString().padStart(2, '0')}
                              </output>
                              <button
                                aria-label="Aumentar quantidade"
                                disabled={quantity >= 99 || printing}
                                onClick={() =>
                                  setQuantity(Math.min(99, quantity + 1))
                                }
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.975 }}
                          disabled={printing || !prepDate}
                          className={`print-button ${printSuccess ? 'success' : ''}`}
                          onClick={printLabel}
                        >
                          {printing ? (
                            <LoaderCircle size={18} className="spin" />
                          ) : printSuccess ? (
                            <CheckCheck size={18} />
                          ) : (
                            <Printer size={18} />
                          )}
                          <span>
                            {printing
                              ? 'Preparando etiqueta...'
                              : printSuccess
                                ? 'Simulação concluída'
                                : `Imprimir ${quantity > 1 ? `${quantity} etiquetas` : 'etiqueta'}`}
                          </span>
                          {!printing && !printSuccess && (
                            <ArrowRight size={17} />
                          )}
                        </motion.button>
                        <p className="print-hint">
                          <ShieldCheck size={12} />
                          Simulação · Prazos ilustrativos de demonstração
                        </p>
                      </section>
                    )}
                  </div>
                  {view === 'etiquetas' && (
                    <div className="lower-grid">
                      {checklistPanel}
                      {expiryPanel}
                    </div>
                  )}
                </>
              )}
              {view === 'checklists' && (
                <div className="dedicated-grid">
                  {checklistPanel}
                  <section className="shift-summary">
                    <span className="note-symbol">✳</span>
                    <h2>
                      O bom serviço
                      <br />
                      começa antes.
                    </h2>
                    <p>
                      Uma rotina clara dá à equipe o que mais importa: tempo
                      para cuidar de cada detalhe.
                    </p>
                    <div className="summary-number">
                      {Math.round((doneCount / allTasks.length) * 100)}
                      <span>%</span>
                    </div>
                    <span>do dia em ordem</span>
                    <div className="progress-track">
                      <motion.div
                        animate={{
                          width: `${(doneCount / allTasks.length) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="summary-note">
                      As tarefas desta prévia são exemplos interativos.
                    </p>
                  </section>
                </div>
              )}
              {view === 'validades' && (
                <section className="glass-panel full-table-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Um olhar atento à validade</h2>
                      <p>Dados de exemplo · Cozinha principal</p>
                    </div>
                    <span className="count-label">
                      {expiry.length} preparos
                    </span>
                  </div>
                  <div className="product-filters">
                    {['Todos', 'Vencidos', 'Vencem hoje', 'Vencem amanhã'].map(
                      (f) => (
                        <button
                          key={f}
                          aria-pressed={expiryFilter === f}
                          className={expiryFilter === f ? 'active' : ''}
                          onClick={() => setExpiryFilter(f)}
                        >
                          {f}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="validity-list">
                    {expiry
                      .filter(
                        (item) =>
                          expiryFilter === 'Todos' ||
                          item.state ===
                            (
                              {
                                Vencidos: 'expired',
                                'Vencem hoje': 'today',
                                'Vencem amanhã': 'tomorrow',
                              } as Record<string, string>
                            )[expiryFilter],
                      )
                      .map((item) => (
                        <div key={item.id} className="validity-row">
                          <img
                            src={`/images/${item.image}.jpg`}
                            width={48}
                            height={48}
                            alt=""
                          />
                          <div>
                            <strong>{item.name}</strong>
                            <small>
                              {item.batch} · {item.quantity}
                            </small>
                          </div>
                          <span className={`status-pill ${item.state}`}>
                            {item.time}
                          </span>
                          <button
                            className="mise-secondary-button"
                            onClick={() => {
                              setExpiry((current) =>
                                current.filter((e) => e.id !== item.id),
                              )
                              setToast(
                                `${item.name}: ${item.state === 'expired' ? 'descarte' : 'consumo'} registrado na demonstração.`,
                              )
                            }}
                          >
                            {item.state === 'expired' ? (
                              <Trash2 size={15} />
                            ) : (
                              <Check size={15} />
                            )}
                            {item.state === 'expired'
                              ? 'Registrar descarte'
                              : 'Marcar consumido'}
                          </button>
                        </div>
                      ))}
                  </div>
                  {expiry.filter(
                    (item) =>
                      expiryFilter === 'Todos' ||
                      item.state ===
                        (
                          {
                            Vencidos: 'expired',
                            'Vencem hoje': 'today',
                            'Vencem amanhã': 'tomorrow',
                          } as Record<string, string>
                        )[expiryFilter],
                  ).length === 0 && (
                    <div className="empty-state">
                      <ShieldCheck size={34} />
                      <h3>Tudo em ordem por aqui.</h3>
                      <p>Nenhum preparo com este status.</p>
                    </div>
                  )}
                </section>
              )}
              {view === 'historico' && (
                <section className="glass-panel full-table-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Do preparo ao registro</h2>
                      <p>Impressões simuladas nesta sessão</p>
                    </div>
                    <button
                      className="mise-secondary-button"
                      onClick={exportHistory}
                    >
                      <ArrowDownToLine size={16} />
                      Exportar CSV
                    </button>
                  </div>
                  {records.length ? (
                    <div className="history-table-scroll">
                      <table className="history-table">
                        <thead>
                          <tr>
                            {[
                              'Produto',
                              'Lote',
                              'Quantidade',
                              'Impressão',
                              'Validade',
                              'Status',
                            ].map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {records.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <strong>{r.name}</strong>
                                <small>{r.storage}</small>
                              </td>
                              <td>{r.id}</td>
                              <td>{r.quantity} un.</td>
                              <td>
                                {new Date(r.date).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td>{formatDate(new Date(r.expiry))}</td>
                              <td>
                                <span className="status-pill valid">
                                  <Check size={12} />
                                  Simulada
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <History size={36} />
                      <h3>A história começa no preparo.</h3>
                      <p>Suas etiquetas simuladas aparecerão aqui.</p>
                      <a className="mise-primary-button" href="#etiquetas">
                        Preparar uma etiqueta <ArrowRight size={16} />
                      </a>
                    </div>
                  )}
                </section>
              )}
              {view === 'visao-geral' && (
                <div className="lower-grid">
                  {checklistPanel}
                  {expiryPanel}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <footer className="workspace-footer">
            <span>
              <Leaf size={13} />
              Feito para quem cuida de cada detalhe.
            </span>
            <span>Mise en place. Peace of mind.</span>
          </footer>
        </div>
        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              className="mise-toast"
              initial={{ opacity: 0, y: 25, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <span>
                <Check size={16} />
              </span>
              {toast}
              <button
                className="icon-button"
                aria-label="Dispensar notificação"
                onClick={() => setToast('')}
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <dialog
          ref={dialogRef}
          aria-labelledby="mise-workspace-dialog-title"
          className="mise-dialog"
          onCancel={() => setDialog(null)}
          onClick={(e) => {
            if (e.currentTarget === e.target) setDialog(null)
          }}
        >
          <div className="dialog-heading">
            <h2 id="mise-workspace-dialog-title">
              {dialog === 'new'
                ? 'Um novo preparo.'
                : dialog === 'printer'
                  ? 'Pronta para o próximo preparo.'
                  : dialog === 'product'
                    ? selected.name
                    : 'Seu cuidado faz a diferença.'}
            </h2>
            <button
              className="icon-button"
              aria-label="Fechar janela"
              onClick={() => setDialog(null)}
            >
              <X size={20} />
            </button>
          </div>
          {dialog === 'new' && (
            <form
              className="new-product-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newName.trim()) return
                const p = {
                  id: `custom-${Date.now()}`,
                  name: newName.trim(),
                  category: newCategory,
                  days: newDays,
                  image: 'tomatoes',
                  detail: 'Preparo da casa',
                  favorite: false,
                }
                setProducts((current) => [...current, p])
                setSelectedId(p.id)
                setCategory('Todos')
                setQuery('')
                setNewName('')
                setDialog(null)
                setToast('Novo preparo adicionado à demonstração.')
              }}
            >
              <p>Adicione um produto ao catálogo desta prévia.</p>
              <label>
                Nome do preparo
                <input
                  required
                  maxLength={60}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex.: Caldo de legumes"
                />
              </label>
              <label>
                Categoria
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  {categories.slice(2).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Prazo ilustrativo sob refrigeração (dias)
                <input
                  required
                  type="number"
                  min={1}
                  max={30}
                  value={newDays}
                  onChange={(e) => setNewDays(Number(e.target.value))}
                />
              </label>
              <button className="mise-primary-button" type="submit">
                <Plus size={17} />
                Adicionar preparo
              </button>
            </form>
          )}
          {dialog === 'printer' && (
            <div className="printer-dialog-content">
              <span className="printer-dialog-icon">
                <Printer size={34} />
              </span>
              <h3>Impressora de prévia</h3>
              <span className="status-pill valid">
                <span className="status-dot" />
                Disponível para simulação
              </span>
              <p>
                Formato térmico de 50 × 50 mm. A prévia demonstra o fluxo de
                impressão sem enviar etiquetas a um equipamento.
              </p>
              <div>
                <span>Formato</span>
                <strong>50 × 50 mm</strong>
              </div>
              <div>
                <span>Conexão</span>
                <strong>Simulada</strong>
              </div>
              <button
                className="mise-primary-button"
                onClick={() => {
                  setDialog(null)
                  setToast(
                    'Prévia pronta. Selecione um preparo para simular a impressão.',
                  )
                }}
              >
                <Check size={16} />
                Tudo pronto
              </button>
            </div>
          )}
          {dialog === 'alerts' && (
            <div className="help-content">
              <p>
                {expiry.length
                  ? `${expiry.length} preparos merecem sua atenção. Confira as validades antes do próximo serviço.`
                  : 'Todos os preparos de exemplo foram conferidos.'}
              </p>
              {expiry.map((e) => (
                <div key={e.id}>
                  <Clock3 size={16} />
                  <span>{e.name}</span>
                  <span className={`status-pill ${e.state}`}>{e.time}</span>
                </div>
              ))}
              <button
                className="mise-primary-button"
                onClick={() => {
                  setDialog(null)
                  window.location.hash = 'validades'
                }}
              >
                Conferir validades <ArrowRight size={16} />
              </button>
            </div>
          )}
          {dialog === 'product' && (
            <div className="product-dialog-content">
              <img
                src={`/images/${selected.image}.jpg`}
                alt=""
                width={120}
                height={120}
              />
              <span className="eyebrow">{selected.category}</span>
              <h3>{selected.name}</h3>
              <p>{selected.detail}</p>
              <span className="status-pill valid">
                <Snowflake size={13} />
                Refrigerado · {selected.days} dias de exemplo
              </span>
              <button
                className="mise-primary-button"
                onClick={() => {
                  setDialog(null)
                  window.location.hash = 'etiquetas'
                }}
              >
                <Printer size={16} />
                Preparar etiqueta
              </button>
            </div>
          )}
        </dialog>
      </div>
    </MotionConfig>
  )
}
