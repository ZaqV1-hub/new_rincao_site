import type { Metadata } from "next";
import { PainelCortesiaFormPage } from "@/components/painel-cortesia-form-page";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Nova Cortesia | Estancia",
  robots: { index: false, follow: false },
};

export default async function PainelNovaCortesiaPageRoute() {
  await requirePainelAccess(["vis_cort"], "/painel/cortesias");
  return <PainelCortesiaFormPage initialValues={{ nome: "" }} mode="create" />;
}
