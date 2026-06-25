import type { Metadata } from "next";
import { IngressoShell } from "@/components/ingresso-shell";
import { PublicAgenda } from "@/components/public-agenda";
import type {
  PublicAgendaEvent,
  PublicAgendaMonth,
} from "@/lib/agenda-contracts";
import {
  buildNavigableAgendaMonths,
  resolveAgendaMonthInRange,
} from "@/lib/agenda-navigation";
import {
  getNextPublicAgendaMonth,
  getPublicAgendaEvents,
  getPublicAgendaMonths,
} from "@/lib/agenda-repository";
import { getAuthenticatedCustomer } from "@/lib/customer-area";
import { resolveSelectedAgendaId } from "@/lib/public-agenda-selection";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata("agenda");
export const dynamic = "force-dynamic";

type AgendaPageProps = {
  searchParams?: Promise<{
    mes?: string;
    ano?: string;
    month?: string;
    year?: string;
    agendaId?: string;
    date?: string;
  }>;
};

function parseMonthYear(params?: {
  mes?: string;
  ano?: string;
  month?: string;
  year?: string;
}) {
  const month = Number(params?.mes ?? params?.month);
  const year = Number(params?.ano ?? params?.year);

  if (
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(year) &&
    year >= 2020 &&
    year <= 2100
  ) {
    return { month, year };
  }

  return null;
}

async function resolveInitialMonthYear(params?: {
  mes?: string;
  ano?: string;
  month?: string;
  year?: string;
}) {
  const requested = parseMonthYear(params);
  const now = new Date();
  const currentMonth = {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
  let availableMonths: PublicAgendaMonth[] = [];
  let error: string | undefined;

  try {
    availableMonths = await getPublicAgendaMonths();
  } catch (loadError) {
    console.error("agenda-page-months-failed", loadError);
    error = "Não foi possível consultar a agenda pública agora.";
  }

  const navigableMonths = buildNavigableAgendaMonths(
    currentMonth,
    availableMonths,
    requested,
  );
  const resolvedRequested = resolveAgendaMonthInRange(requested, navigableMonths);

  if (resolvedRequested) {
    return {
      month: resolvedRequested.month,
      year: resolvedRequested.year,
      availableMonths: navigableMonths,
      error,
    };
  }

  try {
    const nextPublicMonth = await getNextPublicAgendaMonth();

    if (nextPublicMonth) {
      return {
        month: nextPublicMonth.month,
        year: nextPublicMonth.year,
        availableMonths,
        error,
      };
    }
  } catch (nextMonthError) {
    console.error("agenda-page-next-month-failed", nextMonthError);
  }

  return {
    month: currentMonth.month,
    year: currentMonth.year,
    availableMonths: [currentMonth],
    error,
  };
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const resolvedSearchParams = await searchParams;
  const initial = await resolveInitialMonthYear(resolvedSearchParams);
  const customer = await getAuthenticatedCustomer();
  let initialEvents: PublicAgendaEvent[] = [];
  let initialError: string | undefined = initial.error;

  try {
    initialEvents = await getPublicAgendaEvents(initial.month, initial.year);
  } catch (eventsError) {
    console.error("agenda-page-events-failed", eventsError);
    initialError = "Não foi possível consultar a agenda pública agora.";
  }

  const initialSelectedAgendaId = resolveSelectedAgendaId(
    initialEvents,
    resolvedSearchParams?.agendaId,
    resolvedSearchParams?.date,
  );

  return (
    <IngressoShell active="schedule" user={customer} variant="checkout">
      <PublicAgenda
        key={`${initial.year}-${initial.month}-${initialSelectedAgendaId ?? "none"}`}
        initialMonth={initial.month}
        initialYear={initial.year}
        availableMonths={initial.availableMonths}
        initialEvents={initialEvents}
        initialError={initialError}
        initialSelectedAgendaId={initialSelectedAgendaId}
      />
    </IngressoShell>
  );
}
