import { listAccessibleBrands } from "@/app/(dashboard)/eventos/actions";
import { listCampaigns } from "@/app/(dashboard)/campanhas/actions";
import { CampanhasClient } from "./campanhas-client";

export const dynamic = "force-dynamic";

export default async function CampanhasPage() {

  const [campaigns, brands] = await Promise.all([
    listCampaigns(),
    listAccessibleBrands(),
  ]);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Comunicação
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
          Campanhas
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
          Comunicação interna que aparece no app mobile dos colaboradores —
          saúde, eventos e comunicados gerais. Direcionamento por marca + departamento.
        </p>
      </header>

      <CampanhasClient campaigns={campaigns} brands={brands} />
    </div>
  );
}
