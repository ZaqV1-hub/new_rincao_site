import type { Metadata } from "next";
import { PainelConvenioDetailPage } from "@/components/painel-convenio-detail-page";
import { getPainelConvenioDetail } from "@/lib/painel-convenios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe Convenio | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelConvenioDetailPageRoute({
  params,
}: {
  params: Promise<{ agreementId: string }>;
}) {
  await requirePainelAccess(["vis_conve"], "/painel/convenios");
  const { agreementId } = await params;
  const agreement = await getPainelConvenioDetail(agreementId);

  return <PainelConvenioDetailPage agreement={agreement} />;
}
