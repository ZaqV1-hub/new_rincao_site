import type { Metadata } from "next";
import { PainelUsuarioSiteDetailPage } from "@/components/painel-usuario-site-detail-page";
import { getPainelUsuarioSite } from "@/lib/painel-usuario-site";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe Usuario Site | Estancia",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelUsuarioSiteDetailPageRoute({
  params,
}: {
  params: Promise<{ cpf: string }>;
}) {
  const session = await requirePainelAccess("vis_situsu", "/painel/usuario-site");
  const { cpf } = await params;
  const data = await getPainelUsuarioSite(cpf);

  return <PainelUsuarioSiteDetailPage data={data} legacyResources={session.legacyResources} />;
}
