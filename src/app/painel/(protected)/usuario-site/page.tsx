import type { Metadata } from "next";
import { PainelUsuarioSitePage } from "@/components/painel-usuario-site-page";
import { listPainelUsuariosSite } from "@/lib/painel-usuario-site";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Usuario Site | Estancia",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelUsuarioSitePageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePainelAccess("vis_situsu", "/painel/usuario-site");
  const query = await searchParams;
  const data = await listPainelUsuariosSite(query);

  return <PainelUsuarioSitePage data={data} legacyResources={session.legacyResources} />;
}
