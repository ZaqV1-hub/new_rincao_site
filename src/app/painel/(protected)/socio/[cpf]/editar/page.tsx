import type { Metadata } from "next";
import { PainelSocioFormPage } from "@/components/painel-socio-form-page";
import { getPainelSocio, getPainelSocioFormContext } from "@/lib/painel-socios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Socio | Estancia",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelSocioEditPageRoute({
  params,
}: {
  params: Promise<{ cpf: string }>;
}) {
  const session = await requirePainelAccess("vis_socio", "/painel/socio");
  const { cpf } = await params;
  const [socio, context] = await Promise.all([
    getPainelSocio(cpf),
    getPainelSocioFormContext(),
  ]);

  return (
    <PainelSocioFormPage
      categoryOptions={context.categoryOptions}
      legacyResources={session.legacyResources}
      mode="edit"
      socio={socio}
    />
  );
}
