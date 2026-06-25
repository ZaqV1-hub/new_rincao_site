import type { Metadata } from "next";
import { PainelClientesNav } from "@/components/painel-clientes-nav";
import { PainelSchoolTripsManager } from "@/components/painel-school-trips-manager";
import { getOpsSchoolTripsScreenData } from "@/lib/ops-school-trips";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Passeios Escolares | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

function readSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PainelClientesEscolasPasseiosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePainelAccess(
    ["vis_escola"],
    "/painel/clientes/escolas/passeios",
  );
  const query = await searchParams;
  const data = await getOpsSchoolTripsScreenData({
    schoolId: readSearchValue(query.schoolId),
    query: readSearchValue(query.query),
  });

  return (
    <div className="grid gap-5">
      <header className="rounded-[28px] border border-[#d7e5ef] bg-white p-6 shadow-[0_12px_34px_rgba(31,67,98,0.08)]">
        <h1 className="legacy-condensed text-5xl text-[#205a7f]">
          Passeios escolares
        </h1>
        <p className="mt-3 max-w-[80ch] text-sm leading-7 text-[#5d7282]">
          Gerencie datas, status e relatorios de passeios escolares.
        </p>
        <div className="mt-5">
          <PainelClientesNav current="schoolTrips" />
        </div>
      </header>

      <PainelSchoolTripsManager
        data={data}
        actorName={session.actorName}
        actorCpf={session.actorCpf}
      />
    </div>
  );
}
