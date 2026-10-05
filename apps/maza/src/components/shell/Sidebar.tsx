"use client";

import Link from "next/link";
import { useMobileNavigation } from "@/components/ui/useMobileNavigation";
import { usePathname } from "next/navigation";
import { ZoneLink } from "./ZoneLink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NAV_CONFIG, NAV_VERSAO, type NavGroupConfig, type NavItemConfig } from "@/lib/nav-config";
import {
  // shell
  ChevronDown, ChevronRight, Check, LogOut, X,
  // dashboard
  LayoutDashboard,
  // operacao
  TrendingUp, MapPin, Activity, UserCheck, ClipboardList, BookOpen,
  // compras
  ShoppingCart, Package, Truck, Building2, FileText, PackageCheck, PieChart, Star, Carrot,
  // financeiro
  Wallet, Gauge, ArrowLeftRight, Sheet, CreditCard, Banknote, CheckSquare, RefreshCw, PiggyBank,
  // financeiro DRE submenu
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
  ChefHat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth, useUnit } from "@maza/auth/context";

// ── Icon map: nome string → componente Lucide ─────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, TrendingUp, MapPin, Activity, UserCheck, ClipboardList, BookOpen,
  ShoppingCart, Package, Truck, Building2, FileText, PackageCheck, PieChart, Star, Carrot,
  Wallet, Gauge, ArrowLeftRight, Sheet, CreditCard, Banknote, CheckSquare, RefreshCw, PiggyBank,
  Zap, Settings, Wrench, Landmark, BadgeDollarSign,
  Users, User, Briefcase, CalendarDays, Clock, Plane, CalendarX2, Timer,
  ShieldAlert, Receipt, DollarSign, Bus, GraduationCap, ClipboardCheck,
  FolderOpen, Upload, FileBarChart2, MessageCircle, Repeat2, LayoutGrid, ListChecks,
  CalendarClock, Network, UserPlus, BarChart2,
  Handshake, MessageSquare, CalendarCheck, Bot, Megaphone, Filter,
  Bookmark, Info, Globe, Award,
  Brain, Target, LineChart, Layers, Bug, Map, BarChart3, Workflow,
  ChefHat,
};

function resolveIcon(name: string | null): LucideIcon | null {
  if (!name) return null;
  return ICON_MAP[name] ?? null;
}

// ── Tipos internos (ícones resolvidos) ───────────────────────
type NavItem = { href?: string; label: string; icon: LucideIcon; roles?: string[]; defaultOpen?: boolean; children?: NavItem[] };
type NavGroup = {
  id: string;
  title: string | null;
  icon: LucideIcon | null;
  items: NavItem[];
  defaultOpen: boolean;
  habilitado: boolean;
};

function resolveNavItem(it: NavItemConfig): NavItem {
  return {
    href: it.href,
    label: it.label,
    icon: resolveIcon(it.icon) ?? LayoutDashboard,
    roles: it.roles,
    defaultOpen: it.defaultOpen,
    children: it.children ? it.children.map(resolveNavItem) : undefined,
  };
}

function resolveGroups(raw: NavGroupConfig[]): NavGroup[] {
  return raw.map((g) => ({
    id: g.id,
    title: g.label,
    icon: resolveIcon(g.icon),
    defaultOpen: g.defaultOpen,
    habilitado: g.habilitado ?? true,
    items: g.items.map(resolveNavItem),
  }));
}

const NAV_GROUPS: NavGroup[] = resolveGroups(NAV_CONFIG);

const STORAGE_KEY = "maza_sidebar_groups";
const VERSAO_STORAGE_KEY = "maza_sidebar_versao";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { unit, units, setUnit } = useUnit();
  const { hasRegisteredUnits } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  useMobileNavigation(sidebarRef, mobileOpen, closeMobile);
  useEffect(() => { window.dispatchEvent(new CustomEvent("maza:sidebarState", { detail: mobileOpen })); }, [mobileOpen]);
  // Confirmação de logout — modal simples evita clicar o botão Sair
  // sem querer ao navegar em sidebar estreita (1920×1080).
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  useEffect(() => {
    const syncSessionCookie = () => {
      const cookies = document.cookie.split(";").map((item) => item.trim());
      const auth = cookies.find((item) =>
        item.startsWith("sb-") && item.slice(0, item.indexOf("=")).includes("auth-token"),
      );
      if (auth) {
        window.localStorage.setItem("marena_auth_browser_backup", auth);
        return;
      }
      const backup = window.localStorage.getItem("marena_auth_browser_backup");
      if (backup?.startsWith("sb-") && backup.includes("auth-token=")) {
        document.cookie = `${backup}; Path=/; Max-Age=2592000; SameSite=Lax`;
      }
    };
    syncSessionCookie();
    const timer = window.setInterval(syncSessionCookie, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const onToggle = () => setMobileOpen((v) => !v);
    window.addEventListener("maza:toggleSidebar", onToggle);
    return () => window.removeEventListener("maza:toggleSidebar", onToggle);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Nome de exibição: prioriza display_name (user_metadata.display_name,
  // configurado em Auth → Users no painel Supabase). Fallback: e-mail.
  const displayName = user?.displayName?.trim() || null;
  const showName = displayName ?? user?.email ?? null;

  // Iniciais a partir do nome (ex: "Karine Azevedo" → "KA"). Fallback:
  // 2 primeiros caracteres do e-mail (status quo).
  const initials = showName
    ? (displayName
        ? displayName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]!.toUpperCase())
            .join("")
        : user!.email!.slice(0, 2).toUpperCase())
    : "?";

  // Linha única exibida no footer do sidebar. Trunca com ellipsis.
  const label = showName
    ? showName.length > 22
      ? showName.slice(0, 19) + "…"
      : showName
    : "—";
  const role = user?.roles[0]?.role ?? "—";
  const effectiveGroups = useMemo(() => {
    const roles = new Set<string>((user?.roles ?? []).map((entry) => entry.role));
    const hasFullAccess = roles.has("founder");
    const filterItem = (item: NavItem): NavItem | null => {
      if (!hasFullAccess && item.roles?.length && !item.roles.some((allowed) => roles.has(allowed))) return null;
      const children = item.children?.map(filterItem).filter((child): child is NavItem => child !== null);
      if (item.children && !children?.length) return null;
      return { ...item, children };
    };
    return NAV_GROUPS
      .map((group) => ({ ...group, items: group.items.map(filterItem).filter((item): item is NavItem => item !== null) }))
      .filter((group) => group.items.length > 0);
  }, [user?.roles]);

  return (
    <>
      <div
        className={`shell-backdrop ${mobileOpen ? "open" : ""}`}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        id="maza-sidebar"
        aria-label="Navegação principal"
        ref={sidebarRef}
        className={`shell-sidebar ${mobileOpen ? "open" : ""}`}
        style={{
          width: 240, flexShrink: 0,
          background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div className="maza-brand">
          <span className="maza-brand-symbol" aria-hidden="true">m</span>
          <div><div className="maza-brand-word">marena.</div><div className="maza-brand-caption">Gestão com propósito</div></div>
          <button type="button" className="maza-icon-button maza-sidebar-close" aria-label="Fechar menu" onClick={closeMobile}><X size={18} /></button>
        </div>

        <div style={{ padding: "12px 16px" }}>
          <div ref={ref} style={{ position: "relative" }}>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="Selecionar unidade"
              disabled={units.length === 0}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10,
                padding: "9px 12px", color: "var(--text)", fontSize: 13, fontWeight: 600,
                cursor: units.length ? "pointer" : "default",
                transition: "border-color var(--t)",
              }}
            >
              <span
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, minWidth: 0,
                }}
              >
                <span style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 700, letterSpacing: 0.8 }}>
                  UNIDADE
                </span>
                <span
                  style={{
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160,
                  }}
                >
                  {unit?.name ?? (units.length
                    ? "Selecionar…"
                    : hasRegisteredUnits
                      ? "Sem acesso"
                      : "Nenhuma cadastrada")}
                </span>
              </span>
              <ChevronDown
                size={14}
                style={{
                  color: "var(--text-3)",
                  transform: open ? "rotate(180deg)" : "none",
                  transition: "transform var(--t)",
                }}
              />
            </button>
            {open && units.length > 0 && (
              <div
                style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
                  background: "var(--surface-2)", border: "1px solid var(--border-strong)",
                  borderRadius: 10, padding: 4, boxShadow: "var(--shadow-lg)",
                }}
              >
                {units.map((u) => {
                  const active = u.id === unit?.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        setUnit(u.id);
                        setOpen(false);
                      }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 8, padding: "9px 10px",
                        background: active ? "var(--surface-3)" : "transparent",
                        border: "none", borderRadius: 6, color: "var(--text)",
                        fontSize: 13, fontWeight: 500, cursor: "pointer",
                        textAlign: "left", transition: "background var(--t)",
                      }}
                    >
                      <span>{u.name}</span>
                      {active && <Check size={14} style={{ color: "var(--brand)" }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <SidebarNav pathname={pathname} groups={effectiveGroups} />

        <div
          style={{
            padding: "12px 14px", borderTop: "1px solid var(--sidebar-border)",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: 32, height: 32, borderRadius: 99, background: "var(--brand-soft)",
                color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 12,
              }}
            >
              {initials}
            </div>
            <span
              style={{
                position: "absolute", right: -1, bottom: -1,
                width: 10, height: 10, borderRadius: 99,
                background: "#22C55E", border: "2px solid var(--sidebar)",
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12, fontWeight: 600, color: "var(--text)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-3)" }}>
              {role}
            </div>
          </div>
          <button
            type="button"
            title="Sair"
            onClick={() => setSignOutConfirm(true)}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 44, height: 44, borderRadius: "var(--r-md, 6px)",
              color: "var(--text-3)", border: "none", cursor: "pointer",
              background: "transparent",
              transition: "color var(--t, 180ms ease), background var(--t, 180ms ease)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-danger, #FCA5A5)";
              e.currentTarget.style.background = "rgba(252,165,165,0.06)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-3)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* ── Confirm de logout (evita clique acidental) ── */}
      {signOutConfirm && (
        <SignOutConfirm onCancel={() => setSignOutConfirm(false)} />
      )}
    </>
  );
}

/**
 * Modal de confirmação de logout.
 * Evita o problema clássico em sidebar estreita: clicar no item de menu
 * acerta o botão Sair por engano (em 1920×1080 o gap é mínimo).
 *
 * Renderizado fora da <aside> via portal pra não herdar overflow:hidden.
 */
function SignOutConfirm({ onCancel }: { onCancel: () => void }) {
  // ESC cancela.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-title"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface, #1A1A18)",
          border: "1px solid var(--border-strong, rgba(245,240,232,0.16))",
          borderRadius: 12,
          padding: 24,
          maxWidth: 360, width: "100%",
          display: "flex", flexDirection: "column", gap: 16,
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        }}
      >
        <div>
          <h3
            id="signout-title"
            className="font-heading"
            style={{
              fontFamily: "var(--font-display, Georgia, serif)",
              fontSize: 18, fontWeight: 600, color: "var(--text, #F5F0E8)",
              margin: 0, marginBottom: 6,
            }}
          >
            Sair da conta?
          </h3>
          <p
            style={{
              fontSize: 13, color: "var(--text-3, #A09890)",
              margin: 0, lineHeight: 1.5,
            }}
          >
            Você precisará fazer login novamente para acessar o sistema.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: "transparent",
              border: "1px solid var(--border-strong, rgba(245,240,232,0.16))",
              color: "var(--text, #F5F0E8)", cursor: "pointer",
              transition: "background 180ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-2, #222220)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Cancelar
          </button>
          <Link
            href="/auth/sign-out"
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: "var(--color-danger, #DC2626)",
              border: "none", textDecoration: "none",
              color: "#FFFFFF", cursor: "pointer",
              display: "inline-flex", alignItems: "center",
              transition: "background 180ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#B91C1C";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--color-danger, #DC2626)";
            }}
          >
            Sair
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Sub: nav com grupos colapsáveis ──────────────────────────
function SidebarNav({ pathname, groups }: { pathname: string; groups: NavGroup[] }) {
  const allItems = useMemo(
    () =>
      groups.flatMap((g) =>
        g.items.flatMap((it) => {
          const base = it.href ? [{ href: it.href, groupId: g.id }] : [];
          const childItems = (it.children ?? []).flatMap((c) =>
            c.href ? [{ href: c.href, groupId: g.id }] : [],
          );
          return [...base, ...childItems];
        }),
      ),
    [groups],
  );

  const activeHref = useMemo(() => {
    let bestHref: string | null = null;
    let bestLen = -1;
    for (const it of allItems) {
      const matches = pathname === it.href || pathname.startsWith(it.href + "/");
      if (matches && it.href.length > bestLen) {
        bestHref = it.href;
        bestLen = it.href.length;
      }
    }
    return bestHref;
  }, [pathname, allItems]);

  const activeGroupId = useMemo(() => {
    if (!activeHref) return null;
    return allItems.find((it) => it.href === activeHref)?.groupId ?? null;
  }, [activeHref, allItems]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const g of groups) m[g.id] = g.defaultOpen;
    return m;
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const g of groups) {
      for (const it of g.items) {
        if (it.children && it.defaultOpen) m[it.label] = true;
      }
    }
    return m;
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedVersao = window.localStorage.getItem(VERSAO_STORAGE_KEY);
      if (savedVersao !== NAV_VERSAO) {
        // Menu mudou desde a última visita (grupo novo/removido/renomeado) —
        // descarta o estado de expansão salvo em vez de arriscar ficar
        // inconsistente, e volta pro padrão recolhido.
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.setItem(VERSAO_STORAGE_KEY, NAV_VERSAO);
      } else {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, boolean>;
          setOpenMap((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      // ignora corrupção
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenMap((prev) => (prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true }));
  }, [activeGroupId]);

  // Auto-abre o item pai quando um filho está ativo
  useEffect(() => {
    if (!activeHref) return;
    for (const g of groups) {
      for (const it of g.items) {
        if (it.children?.some((c) => c.href === activeHref)) {
          setOpenItems((prev) => (prev[it.label] ? prev : { ...prev, [it.label]: true }));
        }
      }
    }
  }, [activeHref, groups]);

  return (
    <nav
      className="sidebar-nav-scroll"
      style={{
        flex: 1,
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        overflowY: "auto",
      }}
    >
      {groups.map((g) => {
        if (!g.habilitado) {
          return (
            <div
              key={g.id}
              aria-disabled="true"
              title="Módulo não habilitado"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "10px 8px 4px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "var(--text-3)",
                opacity: 0.45,
                cursor: "not-allowed",
                userSelect: "none",
              }}
            >
              {g.icon && <g.icon size={11} style={{ color: "var(--text-3)" }} />}
              <span style={{ flex: 1 }}>{g.title}</span>
            </div>
          );
        }
        const isOpen = openMap[g.id] ?? g.defaultOpen;
        return (
          <details
            key={g.id}
            className="sidebar-disclosure"
            open={isOpen}
            onToggle={(event) => {
              const nextOpen = event.currentTarget.open;
              setOpenMap((prev) => {
                if (prev[g.id] === nextOpen) return prev;
                const next = { ...prev, [g.id]: nextOpen };
                try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
                return next;
              });
            }}
            style={{ display: "flex", flexDirection: "column", gap: 1 }}
          >
            {g.title ? (
              <summary
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: "10px 8px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {g.icon && (
                  <g.icon size={11} style={{ color: "var(--text-3)" }} />
                )}
                <span style={{ flex: 1 }}>{g.title}</span>
                <ChevronRight
                  className="sidebar-disclosure-chevron"
                  size={12}
                  style={{
                    color: "var(--text-3)",
                    transition: hydrated ? "transform var(--t)" : "none",
                  }}
                />
              </summary>
            ) : (
              <summary aria-hidden="true" style={{ display: "none" }} />
            )}
            {g.items.map((it) => {
                const Icon = it.icon;

                if (it.children) {
                  const itemOpen = openItems[it.label] ?? false;
                  const childActive = it.children.some((c) => c.href === activeHref);
                  const highlighted = childActive;
                  return (
                    <details
                      key={it.label}
                      className="sidebar-disclosure sidebar-subdisclosure"
                      open={itemOpen}
                      onToggle={(event) => {
                        const nextOpen = event.currentTarget.open;
                        setOpenItems((prev) => prev[it.label] === nextOpen
                          ? prev
                          : { ...prev, [it.label]: nextOpen });
                      }}
                    >
                      <summary
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "9px 12px",
                          borderRadius: 8,
                          width: "100%",
                          background: highlighted ? "var(--surface-2)" : "transparent",
                          border: "none",
                          color: highlighted ? "var(--text)" : "var(--text-2)",
                          fontSize: 13,
                          fontWeight: highlighted ? 600 : 500,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all var(--t)",
                        }}
                      >
                        {highlighted && (
                          <span
                            style={{
                              position: "absolute",
                              left: -12,
                              top: 6,
                              bottom: 6,
                              width: 3,
                              background: "var(--brand)",
                              borderRadius: "0 4px 4px 0",
                            }}
                          />
                        )}
                        <Icon
                          size={16}
                          strokeWidth={highlighted ? 2.2 : 1.8}
                          style={{ color: highlighted ? "var(--brand)" : "currentColor" }}
                        />
                        <span style={{ flex: 1 }}>{it.label}</span>
                        <ChevronRight
                          className="sidebar-disclosure-chevron"
                          size={12}
                          style={{
                            color: "var(--text-3)",
                            transition: hydrated ? "transform var(--t)" : "none",
                          }}
                        />
                      </summary>
                      {it.children.map((child) => {
                          if (!child.href) return null;
                          const ChildIcon = child.icon;
                          const childIsActive = child.href === activeHref;
                          const ChildNavEl = ZoneLink;
                          return (
                            <ChildNavEl
                              key={child.href}
                              href={child.href}
                              current={childIsActive}
                              style={{
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "7px 12px 7px 28px",
                                borderRadius: 8,
                                textDecoration: "none",
                                color: childIsActive ? "var(--text)" : "var(--text-2)",
                                background: childIsActive ? "var(--surface-2)" : "transparent",
                                fontSize: 12,
                                fontWeight: childIsActive ? 600 : 400,
                                transition: "all var(--t)",
                              }}
                            >
                              {childIsActive && (
                                <span
                                  style={{
                                    position: "absolute",
                                    left: -12,
                                    top: 4,
                                    bottom: 4,
                                    width: 3,
                                    background: "var(--brand)",
                                    borderRadius: "0 4px 4px 0",
                                  }}
                                />
                              )}
                              <ChildIcon
                                size={14}
                                strokeWidth={childIsActive ? 2.2 : 1.8}
                                style={{ color: childIsActive ? "var(--brand)" : "currentColor" }}
                              />
                              <span style={{ flex: 1 }}>{child.label}</span>
                            </ChildNavEl>
                          );
                        })}
                    </details>
                  );
                }

                const active = it.href === activeHref;
                const NavEl = ZoneLink;
                return (
                  <NavEl
                    key={it.href}
                    href={it.href!}
                    current={active}
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "9px 12px",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: active ? "var(--text)" : "var(--text-2)",
                      background: active ? "var(--surface-2)" : "transparent",
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      transition: "all var(--t)",
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          position: "absolute",
                          left: -12,
                          top: 6,
                          bottom: 6,
                          width: 3,
                          background: "var(--brand)",
                          borderRadius: "0 4px 4px 0",
                        }}
                      />
                    )}
                    <Icon
                      size={16}
                      strokeWidth={active ? 2.2 : 1.8}
                      style={{ color: active ? "var(--brand)" : "currentColor" }}
                    />
                    <span style={{ flex: 1 }}>{it.label}</span>
                  </NavEl>
                );
              })}
          </details>
        );
      })}
    </nav>
  );
}
