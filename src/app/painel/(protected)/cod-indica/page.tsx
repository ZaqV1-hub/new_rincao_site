import type { Metadata } from "next";
import { PainelCodIndicaPage } from "@/components/painel-cod-indica-page";
import { listPainelCodIndica } from "@/lib/painel-cod-indica";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Cod Indica | Estancia",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelCodIndicaPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess(["vis_indica"], "/painel/cod-indica");
  const query = await searchParams;
  const data = await listPainelCodIndica({
    page: Array.isArray(query.page) ? query.page[0] : query.page,
    filters: query,
  });

  return <PainelCodIndicaPage data={data} />;
}
