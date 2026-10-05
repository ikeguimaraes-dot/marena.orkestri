import {
  // shell
  Circle,
  // dashboard
  LayoutDashboard,
  // operacao
  TrendingUp, MapPin, Activity, UserCheck, ClipboardList, BookOpen,
  // compras
  ShoppingCart, Package, Truck, Building2, FileText, PackageCheck, PieChart, Star, Carrot,
  // financeiro
  Wallet, Gauge, ArrowLeftRight, Sheet, CreditCard, Banknote, CheckSquare, RefreshCw, PiggyBank,
  Zap, Settings, Wrench, Landmark, BadgeDollarSign,
  // pessoas
  Users, User, Briefcase, CalendarDays, Clock, Plane, CalendarX2, Timer,
  ShieldAlert, Receipt, DollarSign, Bus, GraduationCap, ClipboardCheck,
  FolderOpen, Upload, FileBarChart2, MessageCircle, Repeat2, LayoutGrid, ListChecks, CalendarClock, Network, UserPlus, BarChart2,
  // comercial
  Handshake, MessageSquare, CalendarCheck, Bot, Megaphone, Filter,
  // marca
  Bookmark, Info, Globe, Award,
  // inteligencia
  Brain, Target, LineChart, Layers, Bug, Map, BarChart3, Workflow,
  // mise
  ChefHat, Thermometer, Tag, AlertTriangle, Printer,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

// ── Types ───────────────────────────────────────────────────────────────────

export type NavItem = {
  href?: string
  label: string
  icon: LucideIcon
  roles?: string[]
  defaultOpen?: boolean
  children?: NavItem[]
}

export type NavGroup = {
  id: string
  title: string | null
  icon: LucideIcon | null
  items: NavItem[]
  defaultOpen: boolean
  habilitado: boolean
}

// Schema retornado por /api/nav
export type RemoteNavItem = {
  href?: string
  label: string
  icon: string
  roles?: string[]
  defaultOpen?: boolean
  children?: RemoteNavItem[]
}

export type RemoteNavGroup = {
  id: string
  label: string | null
  icon: string | null
  defaultOpen: boolean
  habilitado?: boolean
  items: RemoteNavItem[]
}

export type NavConfigResponse = {
  versao: string
  shellUrl: string
  groups: RemoteNavGroup[]
}

// ── Icon resolver ───────────────────────────────────────────────────────────
// Ícone desconhecido nunca quebra a tela — cai no Circle neutro. O mapa cobre
// os ícones usados por todas as zonas do shell (o /api/nav devolve a
// navegação inteira, não só o grupo desta zona).

const ICON_MAP: Record<string, LucideIcon> = {
  Circle, LayoutDashboard,
  TrendingUp, MapPin, Activity, UserCheck, ClipboardList, BookOpen,
  ShoppingCart, Package, Truck, Building2, FileText, PackageCheck, PieChart, Star, Carrot,
  Wallet, Gauge, ArrowLeftRight, Sheet, CreditCard, Banknote, CheckSquare, RefreshCw, PiggyBank,
  Zap, Settings, Wrench, Landmark, BadgeDollarSign,
  Users, User, Briefcase, CalendarDays, Clock, Plane, CalendarX2, Timer,
  ShieldAlert, Receipt, DollarSign, Bus, GraduationCap, ClipboardCheck,
  FolderOpen, Upload, FileBarChart2, MessageCircle, Repeat2, LayoutGrid, ListChecks, CalendarClock, Network, UserPlus, BarChart2,
  Handshake, MessageSquare, CalendarCheck, Bot, Megaphone, Filter,
  Bookmark, Info, Globe, Award,
  Brain, Target, LineChart, Layers, Bug, Map, BarChart3, Workflow,
  ChefHat, Thermometer, Tag, AlertTriangle, Printer,
}

export function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Circle
  return ICON_MAP[name] ?? Circle
}

// ── Remote → local conversion ───────────────────────────────────────────────
// Resolver ícone (string → componente) só pode acontecer aqui, no client.
// Referência de componente React não cruza a fronteira RSC — se o server
// tentasse resolver e passar o componente como prop, o Next quebraria com
// "Functions cannot be passed directly to Client Components".

export function convertItem(item: RemoteNavItem): NavItem {
  return {
    href: item.href,
    label: item.label,
    icon: resolveIcon(item.icon),
    roles: item.roles,
    defaultOpen: item.defaultOpen,
    children: item.children?.map(convertItem),
  }
}

export function convertRemoteGroups(remote: RemoteNavGroup[]): NavGroup[] {
  return remote.map((g) => ({
    id: g.id,
    title: g.label,
    icon: g.icon ? resolveIcon(g.icon) : null,
    defaultOpen: g.defaultOpen,
    habilitado: g.habilitado ?? true,
    items: g.items.map(convertItem),
  }))
}
