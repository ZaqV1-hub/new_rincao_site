import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SchoolContractCreatePage } from "@/components/school-contract-create-page";
import { getSchoolContractOptions } from "@/lib/school-contracts";
import { requirePainelAccess } from "@/lib/painel-session";
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
  const session = await requirePainelAccess("vis_contra", "/contrato");

  if (session.legacyRoleId !== 4) {
    redirect("/painel/login?redirect=%2Fcontrato");
  }

  const options = await getSchoolContractOptions();
  const actor =
    session.actorCpf ? await getActivePublicUserByCpf(session.actorCpf) : null;

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
