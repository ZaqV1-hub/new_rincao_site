import type { Metadata } from "next";
import { PainelConvenioFormPage } from "@/components/painel-convenio-form-page";
import {
  getPainelConvenioDetail,
  listPainelConvenioPriceTableOptions,
} from "@/lib/painel-convenios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Convenio | Estancia",
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

export default async function PainelConvenioEditPageRoute({
  params,
}: {
  params: Promise<{ agreementId: string }>;
}) {
  await requirePainelAccess(["vis_conve"], "/painel/convenios");
  const { agreementId } = await params;
  const agreement = await getPainelConvenioDetail(agreementId);
  const priceTableOptions = await listPainelConvenioPriceTableOptions(
    agreement.priceTableId,
  );

  return (
    <PainelConvenioFormPage
      agreementId={agreement.id}
      agreementName={agreement.name}
      initialValues={{
        nmconvenio: agreement.name,
        dtini: toInputDate(agreement.startDate),
        dtfim: toInputDate(agreement.endDate),
        idtabpreco: agreement.priceTableId ? String(agreement.priceTableId) : "",
      }}
      mode="edit"
      priceTableOptions={priceTableOptions}
    />
  );
}
