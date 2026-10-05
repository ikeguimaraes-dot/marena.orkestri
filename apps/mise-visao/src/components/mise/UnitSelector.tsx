"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Unit } from "@/lib/mise/units";

export function UnitSelector({ units, selected }: { units: Unit[]; selected: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("unidade", event.target.value);
    router.push(`/mise?${params.toString()}`);
  }

  return (
    <select
      value={selected}
      onChange={onChange}
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border-soft)",
        borderRadius: 8,
        padding: "8px 12px",
        color: "var(--text)",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {units.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
      <option value="consolidado">Consolidado</option>
    </select>
  );
}
