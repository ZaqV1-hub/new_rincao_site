import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PainelClientTripEditor } from "@/components/painel-client-trip-editor";
import {
  OpsClientTripError,
  getOpsClientTripEditScreenData,
} from "@/lib/ops-client-trips";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Passeio | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

function readSearchValue(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PainelClientesPasseiosEditarPage({
  params,
  searchParams,
}: {
  params: Promise<{ agendaId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePainelAccess(
    ["vis_clientes", "vis_escola"],
    "/painel/clientes/passeios",
  );
  const routeParams = await params;
  const query = await searchParams;
  const agendaId = Number(routeParams.agendaId);
  const clientId = Number(readSearchValue(query.clientId) ?? 0);
  let data: Awaited<ReturnType<typeof getOpsClientTripEditScreenData>>;

  try {
    data = await getOpsClientTripEditScreenData(agendaId, clientId);
  } catch (error) {
    if (error instanceof OpsClientTripError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  return (
    <PainelClientTripEditor
      data={data}
      actorName={session.actorName}
      actorCpf={session.actorCpf}
    />
  );
}
