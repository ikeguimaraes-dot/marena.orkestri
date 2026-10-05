"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { useAuth } from "@maza/auth/context";
import { NotificationBell } from "@/components/shell/NotificationBell";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const subscribe = () => () => {};
const PATH_LABELS: Record<string, string> = { "/": "Visão geral", "/dashboard": "Visão geral", "/operacao": "Operação", "/pessoas": "Pessoas", "/cardapio": "Cardápio", "/compras": "Compras", "/cliente": "Cliente & Experiência", "/inteligencia": "Inteligência", "/marca": "Marca & Cultura", "/financeiro": "Financeiro", "/mise": "MISE", "/orquestrador": "Orquestrador" };

export function TopBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const title = PATH_LABELS[pathname] ?? PATH_LABELS[`/${pathname.split("/")[1]}`] ?? "Marena";
  const name = user?.displayName?.trim().split(/\s+/)[0] || user?.email?.split("@")[0]?.split(".")[0] || "";
  const [cmdOpen, setCmdOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCmdOpen((open) => !open); }
    };
    const onMenu = (event: Event) => setMenuOpen(Boolean((event as CustomEvent<boolean>).detail));
    document.addEventListener("keydown", onKey);
    window.addEventListener("maza:sidebarState", onMenu);
    return () => { document.removeEventListener("keydown", onKey); window.removeEventListener("maza:sidebarState", onMenu); };
  }, []);
  return <header className="maza-topbar">
    <button type="button" className="maza-icon-button maza-menu-trigger" aria-label="Abrir menu de navegação" aria-expanded={menuOpen} aria-controls="maza-sidebar" onClick={() => window.dispatchEvent(new Event("maza:toggleSidebar"))}><Menu size={19} /></button>
    <div className="maza-breadcrumb" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}><strong>{title}</strong><span className="shell-topbar-date" style={{ fontSize: 11 }}>{name ? `Olá, ${name}` : "Seu espaço de gestão"}{mounted ? ` · ${new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })}` : ""}</span></div>
    <div className="maza-topbar-actions"><button type="button" className="maza-search-button" aria-label="Buscar página (Ctrl ou Command K)" onClick={() => setCmdOpen(true)}><Search size={16} /><span>Ir para uma página</span><kbd>⌘ K</kbd></button><ThemeToggle /><NotificationBell /></div>
    <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
  </header>;
}
