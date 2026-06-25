import type { Metadata } from "next";
import { PainelCodIndicaFormPage } from "@/components/painel-cod-indica-form-page";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Cadastro Cod Indica | Estancia",
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
        discountValue: "0.00",
        cashbackPercent: "0.00",
        stcodindica: "ati",
        email: "",
      }}
      mode="create"
    />
  );
}
