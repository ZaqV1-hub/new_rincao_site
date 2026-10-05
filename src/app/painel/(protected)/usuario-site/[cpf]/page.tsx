import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PainelUsuarioSiteDetailPage } from "@/components/painel-usuario-site-detail-page";
import { hasLegacyPanelResource } from "@/lib/painel-access";
import { getPainelUsuarioSite, getPainelUsuarioSiteFallback, PainelUsuarioSiteError, type PainelUsuarioSiteDetail } from "@/lib/painel-usuario-site";
import { requirePainelAccess } from "@/lib/painel-session";
import { getPainelUsuario, PainelUsuariosError } from "@/lib/painel-usuarios";

export const metadata: Metadata = {
  title: "Painel - Detalhe Usuário Site | Rincao",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelUsuarioSiteDetailPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ cpf: string }>;
  searchParams?: Promise<{ comprasPagina?: string }>;
}) {
  const session = await requirePainelAccess(["vis_situsu", "vis_bilhet"], "/painel/usuario-site");
  const { cpf } = await params;
  const requestedPage = Number((await searchParams)?.comprasPagina ?? 1);
  const purchasePage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  let data: PainelUsuarioSiteDetail | null = null;

  try {
    data = await getPainelUsuarioSite(cpf, purchasePage);
  } catch (error) {
    if (!(error instanceof PainelUsuarioSiteError) || error.code !== "site_user_not_found") {
      throw error;
    }

    try {
      await getPainelUsuario(cpf);
    } catch (internalError) {
      if (internalError instanceof PainelUsuariosError && internalError.code === "user_not_found") {
        data = await getPainelUsuarioSiteFallback(cpf, purchasePage);
      } else {
        throw internalError;
      }
    }
  }

  if (!data) {
    redirect(`/painel/usuario/detalhe/${encodeURIComponent(cpf)}`);
  }

  return (
    <PainelUsuarioSiteDetailPage
      canDeleteObservations={data.profileExists && session.legacyRoleId === 1}
      canManage={data.profileExists && hasLegacyPanelResource(session.legacyResources, "vis_situsu")}
      data={data}
      legacyResources={session.legacyResources}
    />
  );
}
