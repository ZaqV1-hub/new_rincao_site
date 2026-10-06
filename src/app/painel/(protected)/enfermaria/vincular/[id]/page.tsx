import { EnfermariaLinkClient } from "@/components/enfermaria-link-client";
import { requirePainelAccess } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

export default async function EnfermariaVincularPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePainelAccess("vis_enfermaria", "/painel/enfermaria");
  if (session.legacyRoleId !== 1) {
    const { redirect } = await import("next/navigation");
    redirect("/painel/enfermaria");
  }
  const { id } = await params;
  return <EnfermariaLinkClient recordId={Number(id)} />;
}
