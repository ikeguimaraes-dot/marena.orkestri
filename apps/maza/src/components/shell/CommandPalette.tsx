"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";

const NAV = [
  { label: "Dashboard",           path: "/dashboard",              group: "Navegar" },
  { label: "Orquestrador",        path: "/orquestrador",           group: "Navegar" },
  { label: "Cardápio",            path: "/cardapio",               group: "Navegar" },
  { label: "Eventos",             path: "/eventos",                group: "Navegar" },
  { label: "Clientes",            path: "/cliente",                group: "Navegar" },
  { label: "Marcas",              path: "/marcas",                 group: "Navegar" },
  { label: "Campanhas",           path: "/campanhas",              group: "Navegar" },
  { label: "Financeiro",          path: "/financeiro",             group: "Financeiro" },
  { label: "Relatórios",          path: "/financeiro/relatorios",  group: "Financeiro" },
  { label: "Headcount",           path: "/pessoas/headcount",      group: "Pessoas" },
  { label: "Agentes de IA",       path: "/pessoas/agentes",        group: "Pessoas" },
  { label: "Vagas abertas",       path: "/recrutamento/vagas",     group: "R&S" },
  { label: "Metas estratégicas",  path: "/inteligencia/metas",     group: "Inteligência" },
  { label: "Insights",            path: "/orquestrador/insights",  group: "Inteligência" },
] as const;

const GROUPS = [...new Set(NAV.map((r) => r.group))];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const router = useRouter();

  const navigate = useCallback(
    (path: string) => {
      onOpenChange(false);
      if (path === "/dashboard") window.location.assign(path);
      else router.push(path);
    },
    [router, onOpenChange],
  );

  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange} label="Navegar no Marena">
      <Command.Input placeholder="Buscar módulo ou ação..." />
      <Command.List>
        <Command.Empty>Nenhum resultado para essa busca.</Command.Empty>
        {GROUPS.map((group) => (
          <Command.Group key={group} heading={group}>
            {NAV.filter((r) => r.group === group).map((r) => (
              <Command.Item
                key={r.path}
                value={r.label}
                onSelect={() => navigate(r.path)}
              >
                {r.label}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
