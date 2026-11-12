import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PainelOperationalCatalog } from "@/components/painel-operational-catalog";
import { listPainelServices } from "@/lib/painel-services";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Serviços adicionais | Painel Rincão",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const session = await requirePainelAccess("vis_ingesp", "/painel/servicos");
  if (session.authSource !== "panel") redirect("/painel/login?redirect=%2Fpainel%2Fservicos");
  return <PainelOperationalCatalog kind="services" items={await listPainelServices()} canEdit={session.legacyRoleId === 1} />;
}
