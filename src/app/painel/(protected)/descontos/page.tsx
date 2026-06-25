import type { Metadata } from "next";
import { PainelDescontosPage } from "@/components/painel-descontos-page";
import { listPainelDiscounts } from "@/lib/painel-descontos";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Descontos | Estancia",
  robots: { index: false, follow: false },
};

export default async function PainelDescontosPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess(["vis_desc"], "/painel/descontos");
  const query = await searchParams;
  const data = await listPainelDiscounts({
    page: Array.isArray(query.page) ? query.page[0] : query.page,
  });
  return <PainelDescontosPage data={data} />;
}
