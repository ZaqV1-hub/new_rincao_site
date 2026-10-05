import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PainelUsuarioSiteDetailPage } from "@/components/painel-usuario-site-detail-page";
import { getPainelUsuarioSite, PainelUsuarioSiteError } from "@/lib/painel-usuario-site";
import { requirePainelAccess } from "@/lib/painel-session";
import { getPainelUsuario, PainelUsuariosError } from "@/lib/painel-usuarios";

export const metadata: Metadata = {
  title: "Painel - Detalhe Usuário Site | Rincao",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelUsuarioSiteDetailPageRoute({
  params,
}: {
  params: Promise<{ cpf: string }>;
}) {
  const session = await requirePainelAccess("vis_situsu", "/painel/usuario-site");
  const { cpf } = await params;
  let data: Awaited<ReturnType<typeof getPainelUsuarioSite>>;

  try {
    data = await getPainelUsuarioSite(cpf);
  } catch (error) {
    if (!(error instanceof PainelUsuarioSiteError) || error.code !== "site_user_not_found") {
      throw error;
    }

    try {
      await getPainelUsuario(cpf);
    } catch (internalError) {
      if (internalError instanceof PainelUsuariosError && internalError.code === "user_not_found") {
        notFound();
      }
      throw internalError;
    }

    redirect(`/painel/usuario/detalhe/${encodeURIComponent(cpf)}`);
  }

  return <PainelUsuarioSiteDetailPage data={data} legacyResources={session.legacyResources} />;
}
