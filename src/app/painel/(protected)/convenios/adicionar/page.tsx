import type { Metadata } from "next";
import { PainelConvenioFormPage } from "@/components/painel-convenio-form-page";
import { listPainelConvenioPriceTableOptions } from "@/lib/painel-convenios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Adicionar Convenio | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelConvenioCreatePageRoute() {
  await requirePainelAccess(["vis_conve"], "/painel/convenios/adicionar");
  const priceTableOptions = await listPainelConvenioPriceTableOptions();

  return (
    <PainelConvenioFormPage
      initialValues={{
        nmconvenio: "",
        dtini: "",
        dtfim: "",
        idtabpreco: "",
      }}
      mode="create"
      priceTableOptions={priceTableOptions}
    />
  );
}
