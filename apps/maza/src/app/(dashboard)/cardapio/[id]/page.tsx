import { notFound } from "next/navigation";
import {
  getMenuItem,
  listRecipeItems,
  listRecipeNotes,
} from "@/app/(dashboard)/cardapio/actions";
import { DetalheFichaClient } from "./detalhe-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FichaTecnicaPage({ params }: Props) {
  const { id } = await params;
  const [item, recipeItems, notes] = await Promise.all([
    getMenuItem(id),
    listRecipeItems(id),
    listRecipeNotes(id),
  ]);
  if (!item) notFound();
  return (
    <DetalheFichaClient item={item} initialItems={recipeItems} initialNotes={notes} />
  );
}
