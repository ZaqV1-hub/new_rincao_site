import type { Metadata } from "next";
import { PainelConvenioMemberDetailPage } from "@/components/painel-convenio-member-detail-page";
import { getPainelConvenioMemberDetail } from "@/lib/painel-convenio-members";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe Conveniado | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelConvenioMemberDetailPageRoute({
  params,
}: {
  params: Promise<{ agreementId: string; memberId: string }>;
}) {
  await requirePainelAccess(["vis_conve"], "/painel/convenios");
  const { agreementId, memberId } = await params;
  const detail = await getPainelConvenioMemberDetail({
    agreementId,
    memberId,
  });

  return <PainelConvenioMemberDetailPage detail={detail} />;
}
