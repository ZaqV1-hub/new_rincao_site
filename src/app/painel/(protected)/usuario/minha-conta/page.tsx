import type { Metadata } from "next";
import { PainelUsuarioAccountPage } from "@/components/painel-usuario-account-page";
import { getPainelUsuario } from "@/lib/painel-usuarios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Minha Conta | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelMinhaContaPage() {
  const session = await requirePainelAccess("vis_usu", "/painel/usuario/minha-conta");
  const data = await getPainelUsuario(session.actorCpf ?? "");

  return (
    <PainelUsuarioAccountPage
      data={data}
      legacyResources={session.legacyResources}
    />
  );
}
