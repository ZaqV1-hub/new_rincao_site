import type { Metadata } from "next";
import { PainelCodIndicaMessagePage } from "@/components/painel-cod-indica-message-page";
import { getPainelCodIndicaMessage } from "@/lib/painel-cod-indica";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Mensagem Cod Indica | Estancia",
  robots: { index: false, follow: false },
};

export default async function PainelCodIndicaMessagePageRoute() {
  await requirePainelAccess(["vis_indica"], "/painel/cod-indica/mensagem");
  const data = await getPainelCodIndicaMessage();

  return <PainelCodIndicaMessagePage data={data} />;
}
