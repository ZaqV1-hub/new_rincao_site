import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PainelTripSchoolReportPage } from "@/components/painel-trip-school-report-page";
import {
  OpsSchoolTripReportError,
  getOpsSchoolTripReport,
} from "@/lib/ops-school-trip-report";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Detalhe do Passeio Escolar | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

function readSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PainelClientesEscolasPasseiosDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ schoolId: string; agendaId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess(
    ["vis_escola"],
    "/painel/clientes/escolas/passeios",
  );

  const routeParams = await params;
  const query = await searchParams;
  const schoolId = routeParams.schoolId;
  const agendaId = routeParams.agendaId;
  const purchaseStatus = readSearchValue(query.purchaseStatus);
  let report: Awaited<ReturnType<typeof getOpsSchoolTripReport>>;

  try {
    report = await getOpsSchoolTripReport({
      schoolId,
      agendaId,
      purchaseStatus,
    });
  } catch (error) {
    if (error instanceof OpsSchoolTripReportError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  const querySuffix = report.filters.purchaseStatus
    ? `?purchaseStatus=${encodeURIComponent(report.filters.purchaseStatus)}`
    : "";
  const csvHref = `/api/ops/admin/schools/${report.trip.schoolId}/trips/${report.trip.agendaId}/report${querySuffix}${querySuffix ? "&" : "?"}format=csv`;
  const pdfHref = `/api/ops/admin/schools/${report.trip.schoolId}/trips/${report.trip.agendaId}/report${querySuffix}${querySuffix ? "&" : "?"}format=pdf`;

  return (
    <PainelTripSchoolReportPage
      report={report}
      heading="Detalhe do passeio"
      ownerName={report.trip.schoolName}
      csvHref={csvHref}
      pdfHref={pdfHref}
      backHref={`/painel/clientes/escolas/passeios?schoolId=${report.trip.schoolId}`}
      backLabel="Voltar ao modulo"
      resetHref={`/painel/clientes/escolas/passeios/${report.trip.schoolId}/${report.trip.agendaId}`}
      navCurrent="schoolTrips"
    />
  );
}
