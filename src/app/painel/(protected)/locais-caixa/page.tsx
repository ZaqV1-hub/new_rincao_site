import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PainelOperationalCatalog } from "@/components/painel-operational-catalog";
import { listPainelCashLocations } from "@/lib/painel-cash-locations";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Locais de caixa | Painel Rincão",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CashLocationsPage() {
  const session = await requirePainelAccess("vis_bilhet", "/painel/locais-caixa");
  if (session.authSource !== "panel") redirect("/painel/login?redirect=%2Fpainel%2Flocais-caixa");
  return <PainelOperationalCatalog kind="locations" items={await listPainelCashLocations()} canEdit={session.legacyRoleId === 1} />;
}
