import type { Metadata } from "next";
import { PainelClientTripsManager } from "@/components/painel-client-trips-manager";
import { listOpsClientTrips } from "@/lib/ops-client-trips";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Passeios | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

function readSearchValue(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PainelClientesPasseiosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePainelAccess(
    ["vis_clientes", "vis_escola"],
    "/painel/clientes/passeios",
  );
  const query = await searchParams;
  const data = await listOpsClientTrips({
    code: readSearchValue(query.codescoladata) || readSearchValue(query.cod) || readSearchValue(query.code),
    query: readSearchValue(query.q) || readSearchValue(query.query),
    typeId: readSearchValue(query.idtipo) || readSearchValue(query.typeId),
    status: readSearchValue(query.status),
    fromDate: readSearchValue(query.de) || readSearchValue(query.fromDate),
    toDate: readSearchValue(query.ate) || readSearchValue(query.toDate),
    page: readSearchValue(query.page),
    pageSize: readSearchValue(query.per) || readSearchValue(query.pageSize),
  });
  const successMessage = readSearchValue(query.success);

  return (
    <PainelClientTripsManager
      data={data}
      actorName={session.actorName}
      actorCpf={session.actorCpf}
      successMessage={successMessage}
    />
  );
}
