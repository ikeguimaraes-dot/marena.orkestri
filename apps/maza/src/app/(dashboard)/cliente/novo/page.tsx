import { redirect } from "next/navigation";
import { getCurrentUnit } from "@maza/auth/unit";
import { NovoClienteClient } from "./novo-cliente-client";

export const dynamic = "force-dynamic";

export default async function NovoClientePage() {
  const unit = await getCurrentUnit();
  if (!unit || !unit.brand_id) redirect("/cliente");
  return (
    <NovoClienteClient
      unitId={unit.id}
      unitName={unit.name}
      brandId={unit.brand_id}
    />
  );
}
