import type { Metadata } from "next";
import { PainelUsuarioDetailPage } from "@/components/painel-usuario-detail-page";
import { getPainelUsuario } from "@/lib/painel-usuarios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe do Usuario | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelUsuarioDetailRoute({
  params,
}: {
  params: Promise<{ cpf: string }>;
}) {
  const session = await requirePainelAccess("vis_usu", "/painel/usuario");
  const { cpf } = await params;
  const data = await getPainelUsuario(cpf);

  return (
    <PainelUsuarioDetailPage
      actorCpf={session.actorCpf}
      data={data}
      legacyResources={session.legacyResources}
    />
  );
}
