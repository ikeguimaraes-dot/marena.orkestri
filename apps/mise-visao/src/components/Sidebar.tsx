"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { convertRemoteGroups, type NavGroup, type NavItem, type RemoteNavGroup } from "@/lib/nav/types";

const ZONES = [
  "financeiro",
  "pessoas",
  "operacao",
  "compras",
  "comercial",
  "marca",
  "inteligencia",
  "mise",
] as const;

function getZone(pathname: string): string {
  if (pathname === "/orquestrador" || pathname.startsWith("/orquestrador/")) {
    return "inteligencia";
  }
  const match = pathname.match(new RegExp(`^/(${ZONES.join("|")})(?:/|$)`));
  return match?.[1] ?? "shell";
}

function getNavigationHref(href: string | undefined, pathname: string, shellUrl: string): string {
  if (!href) return "#";
  if (getZone(href) === getZone(pathname)) return href;
  return shellUrl ? `${shellUrl}${href}` : href;
}

function NavigationLink({
  href,
  pathname,
  shellUrl,
  children,
  style,
  onClick,
}: {
  href?: string;
  pathname: string;
  shellUrl: string;
  children: ReactNode;
  style?: CSSProperties;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const destination = getNavigationHref(href, pathname, shellUrl);
  return (
    <a href={destination} style={style} onClick={onClick}>
      {children}
    </a>
  );
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Chave de estado (localStorage) do nó: usa o href quando existe (estável e
 * legível, ex. "financeiro/dre"), senão cai no label sob o nó pai. */
function nodeKey(parentKey: string, item: NavItem): string {
  if (item.href) return item.href.replace(/^\//, "");
  return `${parentKey}/${slugify(item.label)}`;
}

type FlattenedLeaf = { href: string; keysToOpenWhenActive: string[] };

/**
 * O contrato do /api/nav é recursivo — um item pode ter href, children, ou
 * os dois, em qualquer profundidade. Percorre a árvore inteira coletando
 * toda rota navegável (href) junto da cadeia de chaves de nós expansíveis
 * que precisam abrir quando essa rota está ativa (grupo + cada sub-nó
 * ancestral, incluindo o próprio nó quando ele também é expansível).
 */
function flattenLeaves(groups: NavGroup[]): FlattenedLeaf[] {
  const leaves: FlattenedLeaf[] = [];

  function walk(items: NavItem[], ancestorKeys: string[]) {
    for (const item of items) {
      const parentKey = ancestorKeys[ancestorKeys.length - 1] ?? "";
      const key = nodeKey(parentKey, item);
      const hasChildren = !!item.children?.length;

      if (item.href) {
        leaves.push({ href: item.href, keysToOpenWhenActive: hasChildren ? [...ancestorKeys, key] : ancestorKeys });
      }
      if (hasChildren) {
        walk(item.children!, [...ancestorKeys, key]);
      }
    }
  }

  for (const g of groups) {
    walk(g.items, [g.id]);
  }
  return leaves;
}

const GROUPS_STORAGE_KEY = "maza_sidebar_groups";
const VERSAO_STORAGE_KEY = "maza_sidebar_versao";

export function Sidebar(props: { navGroups: RemoteNavGroup[]; shellUrl: string; navOffline: boolean; navVersao: string }) {
  const { navGroups: rawNavGroups, shellUrl, navOffline, navVersao } = props;
  // Resolução de ícone (string → componente Lucide) tem que acontecer aqui,
  // no client — o server só pode entregar dado serializável (string), nunca
  // o componente em si, senão o Next quebra a fronteira Server→Client
  // Component ("Functions cannot be passed directly to Client Components").
  const navGroups = useMemo(() => convertRemoteGroups(rawNavGroups), [rawNavGroups]);
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--sidebar)",
        borderRight: "1px solid var(--sidebar-border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--sidebar-border)" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: -0.5 }}>Marena</div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-3)",
            marginTop: 2,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          MISE
        </div>
      </div>

      {navOffline && (
        <div
          title="Não foi possível carregar o menu do shell — mostrando apenas as rotas desta zona."
          style={{
            margin: "10px 16px 0",
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(245,158,11,0.10)",
            border: "1px solid rgba(245,158,11,0.35)",
            color: "#F59E0B",
            fontSize: 10,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Menu em modo offline
        </div>
      )}

      <SidebarNav pathname={pathname} groups={navGroups} shellUrl={shellUrl} navVersao={navVersao} />
    </aside>
  );
}

function SidebarNav({
  pathname,
  groups,
  shellUrl,
  navVersao,
}: {
  pathname: string;
  groups: NavGroup[];
  shellUrl: string;
  navVersao: string;
}) {
  const leaves = useMemo(() => flattenLeaves(groups), [groups]);

  const activeMatch = useMemo(() => {
    let best: FlattenedLeaf | null = null;
    let bestLen = -1;
    for (const leaf of leaves) {
      const matches = pathname === leaf.href || pathname.startsWith(leaf.href + "/");
      if (matches && leaf.href.length > bestLen) {
        best = leaf;
        bestLen = leaf.href.length;
      }
    }
    return best;
  }, [pathname, leaves]);

  const activeHref = activeMatch?.href ?? null;

  // Grupos e sub-nós recolhidos por padrão; só a cadeia até a rota ativa
  // abre. Persistido em localStorage e compartilhado entre shell e zonas —
  // se a versao salva divergir da versao atual do /api/nav, descarta o
  // estado e volta ao recolhido (o shell pode ter mudado a estrutura).
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedVersao = window.localStorage.getItem(VERSAO_STORAGE_KEY);
      if (storedVersao !== navVersao) {
        window.localStorage.setItem(VERSAO_STORAGE_KEY, navVersao);
        window.localStorage.removeItem(GROUPS_STORAGE_KEY);
        return;
      }
      const raw = window.localStorage.getItem(GROUPS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        setOpenMap((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // localStorage indisponível (modo privado, etc.) — segue recolhido.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navVersao]);

  useEffect(() => {
    if (!activeMatch || activeMatch.keysToOpenWhenActive.length === 0) return;
    setOpenMap((prev) => {
      const missing = activeMatch.keysToOpenWhenActive.filter((key) => !prev[key]);
      if (missing.length === 0) return prev;
      const next = { ...prev };
      for (const key of missing) next[key] = true;
      return next;
    });
  }, [activeMatch]);

  function toggleKey(key: string) {
    setOpenMap((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage indisponível — o estado só não persiste entre loads.
      }
      return next;
    });
  }

  return (
    <nav
      className="sidebar-nav-scroll"
      style={{ flex: 1, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}
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
                padding: "10px 8px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "var(--text-3)",
                opacity: 0.45,
                cursor: "not-allowed",
              }}
            >
              {g.icon && <g.icon size={11} />}
              <span>{g.title}</span>
            </div>
          );
        }

        const isOpen = openMap[g.id] ?? false;
        return (
          <details
            key={g.id}
            className="sidebar-disclosure"
            open={isOpen}
            onToggle={(event) => {
              const nextOpen = event.currentTarget.open;
              if ((openMap[g.id] ?? false) === nextOpen) return;
              toggleKey(g.id);
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
                {g.icon && <g.icon size={11} style={{ color: "var(--text-3)" }} />}
                <span style={{ flex: 1 }}>{g.title}</span>
                <ChevronRight className="sidebar-disclosure-chevron" size={12} style={{ color: "var(--text-3)" }} />
              </summary>
            ) : (
              <summary aria-hidden="true" style={{ display: "none" }} />
            )}

            {g.items.map((item, idx) => (
              <NavNode
                key={item.href ?? `${g.id}-${idx}`}
                item={item}
                parentKey={g.id}
                depth={0}
                pathname={pathname}
                shellUrl={shellUrl}
                activeHref={activeHref}
                openMap={openMap}
                onToggle={toggleKey}
              />
            ))}
          </details>
        );
      })}
    </nav>
  );
}

function NavNode({
  item,
  parentKey,
  depth,
  pathname,
  shellUrl,
  activeHref,
  openMap,
  onToggle,
}: {
  item: NavItem;
  parentKey: string;
  depth: number;
  pathname: string;
  shellUrl: string;
  activeHref: string | null;
  openMap: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const Icon = item.icon;
  const key = nodeKey(parentKey, item);
  const hasChildren = !!item.children?.length;
  const hasHref = !!item.href;
  const active = hasHref && item.href === activeHref;
  const iconSize = depth === 0 ? 16 : 13;
  const indent = 12 + depth * 24;

  if (!hasChildren && !hasHref) {
    console.warn(`[sidebar] item "${item.label}" sem href e sem children — não renderizado.`);
    return null;
  }

  if (!hasChildren) {
    return (
      <NavigationLink
        href={item.href}
        pathname={pathname}
        shellUrl={shellUrl}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: `9px 12px 9px ${indent}px`,
          borderRadius: 8,
          textDecoration: "none",
          color: active ? "var(--text)" : "var(--text-2)",
          background: active ? "var(--surface-2)" : "transparent",
          fontSize: depth === 0 ? 13 : 12,
          fontWeight: active ? 600 : depth === 0 ? 500 : 400,
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
        <Icon size={iconSize} strokeWidth={active ? 2.2 : 1.8} style={{ color: active ? "var(--brand)" : "currentColor", flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{item.label}</span>
      </NavigationLink>
    );
  }

  const isOpen = openMap[key] ?? false;
  const anyChildActive = activeHref ? childHrefs(item).some((href) => activeHref === href || activeHref.startsWith(href + "/")) : false;

  return (
    <details
      className="sidebar-disclosure sidebar-subdisclosure"
      open={isOpen}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        if ((openMap[key] ?? false) === nextOpen) return;
        onToggle(key);
      }}
    >
      <summary
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          border: "none",
          borderRadius: 8,
          padding: `9px 12px 9px ${indent}px`,
          cursor: "pointer",
          textAlign: "left",
          background: (active || anyChildActive) && !isOpen ? "var(--surface-2)" : "transparent",
          color: active || anyChildActive ? "var(--text)" : "var(--text-2)",
          fontSize: depth === 0 ? 13 : 12,
          fontWeight: active || anyChildActive ? 600 : 500,
          transition: "all var(--t)",
        }}
      >
        <Icon
          size={iconSize}
          strokeWidth={active || anyChildActive ? 2.2 : 1.8}
          style={{ color: active || anyChildActive ? "var(--brand)" : "currentColor", flexShrink: 0 }}
        />
        {hasHref ? (
          // Nó com href E children: o label navega, a seta (resto do
          // summary) expande. stopPropagation impede que o clique no link
          // também dispare o toggle nativo do <summary>.
          <a
            href={getNavigationHref(item.href, pathname, shellUrl)}
            onClick={(event) => event.stopPropagation()}
            style={{ flex: 1, color: "inherit", textDecoration: "none" }}
          >
            {item.label}
          </a>
        ) : (
          <span style={{ flex: 1 }}>{item.label}</span>
        )}
        <ChevronRight
          className="sidebar-disclosure-chevron"
          size={12}
          style={{ color: "var(--text-3)", transition: "transform var(--t)", flexShrink: 0 }}
        />
      </summary>

      {item.children!.map((child, idx) => (
        <NavNode
          key={child.href ?? `${key}-${idx}`}
          item={child}
          parentKey={key}
          depth={depth + 1}
          pathname={pathname}
          shellUrl={shellUrl}
          activeHref={activeHref}
          openMap={openMap}
          onToggle={onToggle}
        />
      ))}
    </details>
  );
}

/** Todos os hrefs alcançáveis a partir de um item (ele mesmo + descendentes). */
function childHrefs(item: NavItem): string[] {
  const own = item.href ? [item.href] : [];
  const nested = item.children?.flatMap(childHrefs) ?? [];
  return [...own, ...nested];
}
