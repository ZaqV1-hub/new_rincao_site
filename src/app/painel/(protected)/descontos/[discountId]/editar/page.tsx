import type { Metadata } from "next";
import { PainelDescontoFormPage } from "@/components/painel-desconto-form-page";
import {
  getPainelDiscount,
  listPainelDiscountTypeOptions,
} from "@/lib/painel-descontos";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Desconto | Estancia",
  robots: { index: false, follow: false },
};

export default async function PainelEditarDescontoPageRoute({
  params,
}: {
  params: Promise<{ discountId: string }>;
}) {
  await requirePainelAccess(["vis_desc"], "/painel/descontos");
  const { discountId } = await params;
  const [discount, discountTypes] = await Promise.all([
    getPainelDiscount(discountId),
    listPainelDiscountTypeOptions(),
  ]);

  return (
    <PainelDescontoFormPage
      discountId={discount.id}
      discountTypes={discountTypes}
      initialValues={{
        tipo_id: discount.typeId ? String(discount.typeId) : "",
        nome: discount.name,
        tipo_aplicacao: discount.applicationType ?? "percentual",
        valor: discount.value,
      }}
      mode="edit"
    />
  );
}
