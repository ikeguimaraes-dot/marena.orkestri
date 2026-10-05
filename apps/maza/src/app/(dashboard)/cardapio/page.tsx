import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonVariants } from "@maza/ui/button";
import { listMenuItems } from "@/app/(dashboard)/cardapio/actions";
import { listAccessibleBrands } from "@/app/(dashboard)/eventos/actions";
import { CardapioClient } from "./cardapio-client";

export const dynamic = "force-dynamic";

export default async function CardapioPage() {

  const [items, brands] = await Promise.all([
    listMenuItems(),
    listAccessibleBrands(),
  ]);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            Operacional · Cardápio
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              margin: "6px 0 4px",
              color: "var(--text)",
              letterSpacing: -0.4,
            }}
          >
            Engenharia de Cardápio
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              margin: 0,
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            Catálogo de itens com CMV (Custo Mercadoria Vendida) por marca.
            Verde &lt; 28%, amarelo 28–35%, vermelho &gt; 35%.
          </p>
        </div>
        <Link href="/cardapio/novo" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo item
        </Link>
      </header>

      <CardapioClient items={items} brands={brands} />
    </div>
  );
}
