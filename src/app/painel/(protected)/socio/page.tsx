import type { Metadata } from "next";
import { PainelSociosPage } from "@/components/painel-socios-page";
import { listPainelSocios } from "@/lib/painel-socios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Socios | Estancia",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelSociosPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePainelAccess("vis_socio", "/painel/socio");
  const query = await searchParams;
  const data = await listPainelSocios(query);

  return <PainelSociosPage data={data} legacyResources={session.legacyResources} />;
}
