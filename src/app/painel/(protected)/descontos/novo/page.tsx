import type { Metadata } from "next";
import { PainelDescontoFormPage } from "@/components/painel-desconto-form-page";
import { listPainelDiscountTypeOptions } from "@/lib/painel-descontos";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Novo Desconto | Estancia",
  robots: { index: false, follow: false },
};

export default async function PainelNovoDescontoPageRoute() {
  await requirePainelAccess(["vis_desc"], "/painel/descontos");
  const discountTypes = await listPainelDiscountTypeOptions();
  return (
    <PainelDescontoFormPage
      discountTypes={discountTypes}
      initialValues={{ tipo_id: "", nome: "", tipo_aplicacao: "percentual", valor: "" }}
      mode="create"
    />
  );
}
