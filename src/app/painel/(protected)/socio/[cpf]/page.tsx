import type { Metadata } from "next";
import { PainelSocioDetailPage } from "@/components/painel-socio-detail-page";
import { getPainelSocio } from "@/lib/painel-socios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe Socio | Estancia",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelSocioDetailPageRoute({
  params,
}: {
  params: Promise<{ cpf: string }>;
}) {
  const session = await requirePainelAccess("vis_socio", "/painel/socio");
  const { cpf } = await params;
  const data = await getPainelSocio(cpf);

  return <PainelSocioDetailPage data={data} legacyResources={session.legacyResources} />;
}
