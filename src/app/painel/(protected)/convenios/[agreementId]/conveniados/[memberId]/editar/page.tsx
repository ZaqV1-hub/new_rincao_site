import type { Metadata } from "next";
import { PainelConvenioMemberFormPage } from "@/components/painel-convenio-member-form-page";
import { getPainelConvenioMemberDetail } from "@/lib/painel-convenio-members";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Conveniado | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

function toInputDate(value: string | null) {
  if (!value) {
    return "";
  }

  const [day, month, year] = value.split("/");
  if (!day || !month || !year) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

export default async function PainelConvenioMemberEditPageRoute({
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

  return (
    <PainelConvenioMemberFormPage
      agreementId={detail.agreementId}
      initialValues={{
        cpf: detail.cpf,
        qtcompradia: String(detail.dailyPurchaseLimit),
        dtiniado: toInputDate(detail.startDate),
        dtfimado: toInputDate(detail.endDate),
      }}
      memberId={detail.cpf}
      mode="edit"
    />
  );
}
