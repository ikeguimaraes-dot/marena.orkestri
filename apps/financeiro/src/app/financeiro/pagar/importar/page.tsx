import { requireUser } from "@maza/auth/server";
import { getCurrentUnitComOrigem } from "@maza/auth/unit";
import { AvisoUnidadeFallback } from "@/components/financeiro/AvisoUnidadeFallback";
import { ImportarComprasClient } from "@/components/financeiro/pagar/ImportarComprasClient";



export const dynamic = "force-dynamic";

export default async function ImportarComprasPage() {
  await requireUser();
  const { unit, cookiePresente } = await getCurrentUnitComOrigem();

  if (!unit) return <p>Cadastre uma unidade antes de importar compras.</p>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <AvisoUnidadeFallback cookiePresente={cookiePresente} />
      <ImportarComprasClient unitIdInicial={unit.id} />
    </div>
  );
}
