import type { Metadata } from "next";
import { PainelConveniosPage } from "@/components/painel-convenios-page";
import { listPainelConvenios } from "@/lib/painel-convenios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Convenios | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelConveniosPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess(["vis_conve"], "/painel/convenios");
  const query = await searchParams;
  const data = await listPainelConvenios({
    page: Array.isArray(query.page) ? query.page[0] : query.page,
    filters: query,
  });

  return <PainelConveniosPage data={data} />;
}
