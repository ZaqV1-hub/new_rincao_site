import type { Metadata } from "next";
import { PainelConvenioMembersPage } from "@/components/painel-convenio-members-page";
import { listPainelConvenioMembers } from "@/lib/painel-convenio-members";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Conveniados | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelConvenioMembersPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ agreementId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess(["vis_conve"], "/painel/convenios");
  const { agreementId } = await params;
  const query = await searchParams;
  const data = await listPainelConvenioMembers({
    agreementId,
    page: Array.isArray(query.page) ? query.page[0] : query.page,
    filters: query,
  });

  return <PainelConvenioMembersPage data={data} />;
}
