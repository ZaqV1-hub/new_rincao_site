import type { Metadata } from "next";
import { PainelCategoriasPage } from "@/components/painel-categorias-page";
import { listPainelDiscountTypes } from "@/lib/painel-descontos";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Categorias | Estancia",
  robots: { index: false, follow: false },
};

export default async function PainelCategoriasPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess(["vis_desc"], "/painel/categorias");
  const query = await searchParams;
  const data = await listPainelDiscountTypes({
    page: Array.isArray(query.page) ? query.page[0] : query.page,
  });
  return <PainelCategoriasPage data={data} />;
}
