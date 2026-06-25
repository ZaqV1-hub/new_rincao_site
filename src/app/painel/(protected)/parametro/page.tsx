import type { Metadata } from "next";
import { PainelParametrosPage } from "@/components/painel-parametros-page";
import { listPainelParametros } from "@/lib/painel-parametros";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Parametros | Estancia",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelParametrosPageRoute() {
  const session = await requirePainelAccess("vis_param", "/painel/parametro");
  const groups = await listPainelParametros();

  return <PainelParametrosPage groups={groups} legacyResources={session.legacyResources} />;
}
