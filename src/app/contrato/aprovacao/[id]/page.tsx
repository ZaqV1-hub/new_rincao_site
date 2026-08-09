import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SchoolContractApprovalPage } from "@/components/school-contract-approval-page";
import { getSchoolContractApproval } from "@/lib/school-contracts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aprovação de Contrato Escolar | Rincão",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ContratoAprovacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const approval = await getSchoolContractApproval(id);

  if (!approval) {
    notFound();
  }

  return <SchoolContractApprovalPage approval={approval} />;
}
