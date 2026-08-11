import type { Metadata } from "next";
import { SchoolContractCreatePage } from "@/components/school-contract-create-page";
import { getSchoolContractOptions } from "@/lib/school-contracts";
import { requireRepresentativeContractSession } from "@/lib/painel-session";
import { getActivePublicUserByCpf } from "@/lib/user-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contrato Escolar | Rincão",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ContratoPage() {
  const session = await requireRepresentativeContractSession("/contrato");
  const options = await getSchoolContractOptions();
  const actor = session.actorCpf
    ? await getActivePublicUserByCpf(session.actorCpf)
    : null;

  return (
    <SchoolContractCreatePage
      actor={{
        name: actor?.name ?? session.actorName ?? "",
        email: actor?.email ?? "",
        roleId: session.legacyRoleId ?? null,
      }}
      options={options}
    />
  );
}
