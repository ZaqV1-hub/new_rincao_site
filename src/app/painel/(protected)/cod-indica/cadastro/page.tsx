import type { Metadata } from "next";
import { PainelCodIndicaFormPage } from "@/components/painel-cod-indica-form-page";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Cadastro de Código de Indicação | Rincão",
  robots: { index: false, follow: false },
};

export default async function PainelCodIndicaCreatePageRoute() {
  await requirePainelAccess(["vis_indica"], "/painel/cod-indica/cadastro");

  return (
    <PainelCodIndicaFormPage
      initialValues={{
        codindica: "",
        nmrepresentante: "",
        validade: "",
        vlvendanormal: "0.00",
        vlvendainfant: "0.00",
        vlcashbacknormal: "0.00",
        vlcashbackinfant: "0.00",
        stcodindica: "ati",
        email: "",
        flpromocional: "n",
        vldescnormal: "0.00",
        vlcashbackpromonormal: "0.00",
        vlcashbackpromoinfant: "0.00",
      }}
      mode="create"
    />
  );
}

