import type { Metadata } from "next";
import { PainelCodIndicaFormPage } from "@/components/painel-cod-indica-form-page";
import {
  getPainelCodIndica,
  mapPainelCodIndicaToFormValues,
} from "@/lib/painel-cod-indica";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Cod Indica | Estancia",
  robots: { index: false, follow: false },
};

export default async function PainelCodIndicaEditPageRoute({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  await requirePainelAccess(["vis_indica"], "/painel/cod-indica");
  const { codigo } = await params;
  const code = await getPainelCodIndica(codigo);

  return (
    <PainelCodIndicaFormPage
      codigo={code.codindica}
      initialValues={mapPainelCodIndicaToFormValues(code)}
      mode="edit"
    />
  );
}
