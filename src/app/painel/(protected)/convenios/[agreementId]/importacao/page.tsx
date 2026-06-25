import type { Metadata } from "next";
import { PainelConvenioImportPage } from "@/components/painel-convenio-import-page";
import {
  getPainelConvenioImportState,
  type PainelConvenioImportStage,
} from "@/lib/painel-convenio-import";
import { getPainelConvenioDetail } from "@/lib/painel-convenios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Importar Conveniados | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelConvenioImportPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ agreementId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess(["vis_conve"], "/painel/convenios");

  const { agreementId } = await params;
  const query = await searchParams;
  const agreement = await getPainelConvenioDetail(agreementId);
  const importId = Array.isArray(query.importId) ? query.importId[0] : query.importId;
  const completed = (Array.isArray(query.c) ? query.c[0] : query.c) === "sim";

  const initialStage: PainelConvenioImportStage | null = importId
    ? await getPainelConvenioImportState({
        agreementId,
        importId,
      })
    : null;

  return (
    <PainelConvenioImportPage
      agreementId={agreement.id}
      agreementName={agreement.name}
      completed={completed}
      initialStage={initialStage}
    />
  );
}
