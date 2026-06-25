import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReservationPage } from "@/components/reservation-page";
import { parseAgendaId } from "@/lib/agenda-id";
import { getPublicAgendaReservationById } from "@/lib/agenda-repository";
import { requireAuthenticatedCustomer } from "@/lib/customer-area";

export const metadata: Metadata = {
  title: "Agendar Visita | Estancia",
  description: "Reserva de visita com pagamento no parque no Estancia.",
};

export const dynamic = "force-dynamic";

type ReservationRoutePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ReservationRoutePage({
  params,
}: ReservationRoutePageProps) {
  const { id } = await params;

  const customer = await requireAuthenticatedCustomer(`/agendar/${id}`);

  const agendaId = parseAgendaId(id);

  if (!agendaId) {
    notFound();
  }

  const agenda = await getPublicAgendaReservationById(agendaId);

  if (!agenda) {
    notFound();
  }

  return <ReservationPage agenda={agenda} user={customer} />;
}
