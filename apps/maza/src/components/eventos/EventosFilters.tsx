"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { STATUS_LABEL } from "@/lib/eventos/labels";
import type { BrandOption } from "@/lib/eventos/types";
import type { EventStatus } from "@maza/db/types/database";

const STATUS_OPTIONS: EventStatus[] = [
  "rascunho",
  "pendente_aprovacao",
  "aprovado",
  "confirmado",
  "em_andamento",
  "realizado",
  "concluido",
  "cancelado",
];

/**
 * Filtros sincronizados com query string (search params). Server Component
 * page.tsx lê o searchParams e passa pra listEvents — atualizar o URL refaz
 * o fetch SSR.
 */
export function EventosFilters({ brands }: { brands: BrandOption[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const [search, setSearch] = useState(sp.get("q") ?? "");
  const brand = sp.get("brand") ?? "";
  const status = sp.get("status") ?? "";

  // Debounce do search — 350ms
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (search) params.set("q", search);
      else params.delete("q");
      router.replace(`/eventos?${params.toString()}`);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/eventos?${params.toString()}`);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      <select
        value={brand}
        onChange={(e) => updateParam("brand", e.target.value)}
        style={SELECT}
      >
        <option value="">Todas as marcas</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => updateParam("status", e.target.value)}
        style={SELECT}
      >
        <option value="">Todos os status</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <div style={{ position: "relative", minWidth: 240 }}>
        <Search
          size={14}
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-3)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...SELECT, paddingLeft: 32, minWidth: 240 }}
        />
      </div>
    </div>
  );
}

const SELECT: React.CSSProperties = {
  padding: "8px 14px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};
