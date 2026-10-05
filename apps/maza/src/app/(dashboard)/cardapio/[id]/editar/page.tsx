import { notFound } from "next/navigation";
import { getMenuItem } from "@/app/(dashboard)/cardapio/actions";
import { listAccessibleBrands } from "@/app/(dashboard)/eventos/actions";
import { CardapioFormClient } from "../../cardapio-form-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditarCardapioItemPage({ params }: Props) {
  const { id } = await params;
  const [item, brands] = await Promise.all([
    getMenuItem(id),
    listAccessibleBrands(),
  ]);
  if (!item) notFound();
  return (
    <div style={{ padding: "0 4px" }}>
      <CardapioFormClient mode="edit" brands={brands} initial={item} />
    </div>
  );
}
