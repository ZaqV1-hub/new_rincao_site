import type { Metadata } from "next";
import { PainelCortesiasPage } from "@/components/painel-cortesias-page";
import { listPainelCortesias } from "@/lib/painel-cortesias";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Cortesias | Estancia",
  robots: { index: false, follow: false },
};

export default async function PainelCortesiasPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess(["vis_cort"], "/painel/cortesias");
  const query = await searchParams;
  const data = await listPainelCortesias({
    page: Array.isArray(query.page) ? query.page[0] : query.page,
    perPage: Array.isArray(query.pp) ? query.pp[0] : query.pp,
  });
  return <PainelCortesiasPage data={data} />;
}
