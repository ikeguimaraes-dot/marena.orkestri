import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@maza/db/supabase/server";
import type { Brand, BrandLink, BrandLinkKind } from "@maza/db/types/database";

const KIND_LABEL: Record<BrandLinkKind, string> = {
  drive: "Arquivos",
  dashboard: "Dashboard",
  instagram: "Instagram",
  site: "Site",
  report: "Relatório",
  other: "Outro",
};

export const dynamic = "force-dynamic";

export default async function MarcasPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");

  const [brandsRes, linksRes] = await Promise.all([
    supabase
      .from("brands")
      .select("id, group_id, name, slug, color, active, created_at")
      .eq("active", true)
      .order("name"),
    supabase
      .from("brand_links")
      .select("id, brand_id, kind, url, label, ordem, created_at")
      .order("ordem"),
  ]);

  const brands = (brandsRes.data ?? []) as Brand[];
  const links = (linksRes.data ?? []) as BrandLink[];

  const linksByBrand = new Map<string, BrandLink[]>();
  for (const l of links) {
    const arr = linksByBrand.get(l.brand_id) ?? [];
    arr.push(l);
    linksByBrand.set(l.brand_id, arr);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Fase E1 · Diretório
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            margin: "8px 0 6px",
            color: "var(--text)",
            letterSpacing: -0.5,
          }}
        >
          Marcas do Grupo
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-2)",
            maxWidth: 620,
            lineHeight: 1.6,
          }}
        >
          Hub consolidado das marcas operacionais — substitui os portais Netlify
          externos. Drive, dashboards e canais por marca.
        </p>
      </header>

      {brands.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            borderRadius: 12,
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Nenhuma marca cadastrada para seu acesso.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          }}
        >
          {brands.map((b) => (
            <BrandCard
              key={b.id}
              brand={b}
              links={linksByBrand.get(b.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BrandCard({ brand, links }: { brand: Brand; links: BrandLink[] }) {
  const accent = brand.color || "#D4A574";
  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "22px 20px 18px",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accent,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: accent,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: -0.3,
          }}
        >
          {brand.name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              letterSpacing: -0.2,
            }}
          >
            {brand.name}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              letterSpacing: 0.4,
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            {brand.slug}
          </div>
        </div>
      </div>

      {links.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            fontStyle: "italic",
            padding: "6px 0",
          }}
        >
          Sem links cadastrados.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {links.map((l) => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "9px 12px",
                borderRadius: 8,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: 12,
                fontWeight: 500,
                textDecoration: "none",
                transition: "border-color var(--t)",
              }}
            >
              <span>{l.label ?? KIND_LABEL[l.kind] ?? l.kind}</span>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-3)",
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                ↗
              </span>
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
