import type { Metadata } from "next";
import { PainelConvenioMemberFormPage } from "@/components/painel-convenio-member-form-page";
import { getPainelConvenioDetail } from "@/lib/painel-convenios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Adicionar Conveniado | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelConvenioMemberCreatePageRoute({
  params,
}: {
  params: Promise<{ agreementId: string }>;
}) {
  await requirePainelAccess(["vis_conve"], "/painel/convenios");
  const { agreementId } = await params;
  const agreement = await getPainelConvenioDetail(agreementId);

  return (
    <PainelConvenioMemberFormPage
      agreementId={agreement.id}
      initialValues={{
        cpf: "",
        qtcompradia: "",
        dtiniado: "",
        dtfimado: "",
      }}
      mode="create"
    />
  );
}
