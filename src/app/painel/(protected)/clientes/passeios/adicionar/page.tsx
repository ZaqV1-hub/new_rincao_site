import type { Metadata } from "next";
import { PainelClientTripEditor } from "@/components/painel-client-trip-editor";
import { getOpsClientTripCreateScreenData } from "@/lib/ops-client-trips";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Vincular Passeio | Estancia",
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

export default async function PainelClientesPasseiosAdicionarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePainelAccess(
    ["vis_clientes", "vis_escola"],
    "/painel/clientes/passeios/adicionar",
  );
  const query = await searchParams;
  const data = await getOpsClientTripCreateScreenData({
    agendaId: Number(readSearchValue(query.idagenda) ?? 0),
    clientId: Number(readSearchValue(query.idcliente) ?? 0),
  });

  return (
    <PainelClientTripEditor
      data={data}
      actorName={session.actorName}
      actorCpf={session.actorCpf}
    />
  );
}
