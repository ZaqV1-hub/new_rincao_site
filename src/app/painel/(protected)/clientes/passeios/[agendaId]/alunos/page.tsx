import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PainelClientTripDetailPage } from "@/components/painel-client-trip-detail-page";
import {
  asPainelClientTripDetailError,
  getPainelClientTripDetail,
} from "@/lib/painel-client-trip-detail";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Alunos do Passeio | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

function readSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PainelClientesPasseiosAlunosPage({
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
  const agendaId = routeParams.agendaId;
  const clientId = readSearchValue(query.clientId);
  const purchaseStatus = readSearchValue(query.purchaseStatus);
  let report: Awaited<ReturnType<typeof getPainelClientTripDetail>>;

  try {
    report = await getPainelClientTripDetail({
      agendaId,
      clientId,
      purchaseStatus,
    });
  } catch (error) {
    const mappedError = asPainelClientTripDetailError(error);

    if (mappedError.status === 404) {
      notFound();
    }

    throw error;
  }

  const csvHref = `/api/painel/clientes/passeios/${report.trip.agendaId}/report?clientId=${report.trip.clientId}${
    report.filters.purchaseStatus
      ? `&purchaseStatus=${encodeURIComponent(report.filters.purchaseStatus)}`
      : ""
  }&format=csv`;
  const pdfHref = `/api/painel/clientes/passeios/${report.trip.agendaId}/report?clientId=${report.trip.clientId}${
    report.filters.purchaseStatus
      ? `&purchaseStatus=${encodeURIComponent(report.filters.purchaseStatus)}`
      : ""
  }&format=pdf`;

  return (
    <PainelClientTripDetailPage
      csvHref={report.isSchool ? csvHref : undefined}
      data={report}
      isManager={session.legacyRoleId === 1}
      pdfHref={report.isSchool ? pdfHref : undefined}
    />
  );
}
