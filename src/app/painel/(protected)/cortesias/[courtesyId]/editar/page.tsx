import type { Metadata } from "next";
import { PainelCortesiaFormPage } from "@/components/painel-cortesia-form-page";
import { getPainelCortesia } from "@/lib/painel-cortesias";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Cortesia | Estancia",
  robots: { index: false, follow: false },
};

export default async function PainelEditarCortesiaPageRoute({
  params,
}: {
  params: Promise<{ courtesyId: string }>;
}) {
  await requirePainelAccess(["vis_cort"], "/painel/cortesias");
  const { courtesyId } = await params;
  const courtesy = await getPainelCortesia(courtesyId);
  return (
    <PainelCortesiaFormPage
      courtesyId={courtesy.id}
      initialValues={{ nome: courtesy.name }}
      mode="edit"
    />
  );
}
