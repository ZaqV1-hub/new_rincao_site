import type { Metadata } from "next";
import { PainelContestacoesPage } from "@/components/painel-contestacoes-page";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Contestações Cielo | Rincao",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelContestacoesRoute() {
  await requirePainelAccess("vis_compra", "/painel/compras/contestacoes");

  return <PainelContestacoesPage />;
}
