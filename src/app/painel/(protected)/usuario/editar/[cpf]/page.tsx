import type { Metadata } from "next";
import { PainelUsuarioFormPage } from "@/components/painel-usuario-form-page";
import { getPainelUsuario } from "@/lib/painel-usuarios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Usuario | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelEditarUsuarioPage({
  params,
}: {
  params: Promise<{ cpf: string }>;
}) {
  const session = await requirePainelAccess("vis_usu", "/painel/usuario");
  const { cpf } = await params;
  const user = await getPainelUsuario(cpf);

  return (
    <PainelUsuarioFormPage
      legacyResources={session.legacyResources}
      mode="edit"
      user={user}
    />
  );
}
