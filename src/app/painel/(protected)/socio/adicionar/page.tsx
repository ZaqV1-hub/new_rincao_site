import type { Metadata } from "next";
import { PainelSocioFormPage } from "@/components/painel-socio-form-page";
import { getPainelSocioFormContext } from "@/lib/painel-socios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Adicionar Socio | Estancia",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelSocioCreatePageRoute() {
  const session = await requirePainelAccess("vis_socio", "/painel/socio/adicionar");
  const context = await getPainelSocioFormContext();

  return (
    <PainelSocioFormPage
      categoryOptions={context.categoryOptions}
      legacyResources={session.legacyResources}
      mode="create"
    />
  );
}
