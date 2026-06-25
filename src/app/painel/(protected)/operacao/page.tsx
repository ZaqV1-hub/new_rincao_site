import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDefaultPainelPath, hasLegacyPanelResource } from "@/lib/painel-access";
import { requirePainelSession } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Operacao | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelOperacaoPage() {
  const session = await requirePainelSession("/painel/operacao");

  if (hasLegacyPanelResource(session.legacyResources, "vis_bilhet")) {
    redirect("/painel/bilheteria");
  }

  if (hasLegacyPanelResource(session.legacyResources, "vis_compra")) {
    redirect("/painel/compras");
  }

  redirect(getDefaultPainelPath(session.legacyRoleId));
}
