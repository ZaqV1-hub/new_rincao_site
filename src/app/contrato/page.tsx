import type { Metadata } from "next";
import { SchoolContractCreatePage } from "@/components/school-contract-create-page";
import { getSchoolContractOptions } from "@/lib/school-contracts";
import { requirePainelAccess } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contrato Escolar | Rincão",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ContratoPage() {
  await requirePainelAccess("vis_contrato", "/contrato");
  const options = await getSchoolContractOptions();

  return <SchoolContractCreatePage options={options} />;
}
