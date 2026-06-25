import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaWorkstation } from "@/components/painel-bilheteria-workstation";
import { getPublicAgendaEvents } from "@/lib/agenda-repository";
import {
  lookupPainelBilheteriaTicketByVoucherId,
  type PainelBilheteriaTicketLookupResult,
  type PainelBilheteriaWorkstationError,
} from "@/lib/painel-bilheteria-workstation";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Bilheteria | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

function getSaoPauloToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

export default async function PainelBilheteriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    consult?: string;
    ingresso?: string;
  }>;
}) {
  const session = await requirePainelAccess("vis_bilhet", "/painel/bilheteria");
  const params = await searchParams;
  const today = getSaoPauloToday();
  const [year, month] = today.split("-").map(Number);
  const hasOpenAgendaToday = (await getPublicAgendaEvents(month, year)).some(
    (agenda) => agenda.date === today && agenda.status === "abe",
  );
  let initialTicketLookupState:
    | {
        isOpen: boolean;
        lookup: string;
        result: PainelBilheteriaTicketLookupResult | null;
        error: string | null;
      }
    | undefined;

  if (params.consult === "1" || params.ingresso) {
    const lookup = String(params.ingresso ?? "").trim();
    let result: PainelBilheteriaTicketLookupResult | null = null;
    let error: string | null = null;

    if (lookup) {
      try {
        result = await lookupPainelBilheteriaTicketByVoucherId(lookup);
      } catch (cause) {
        error =
          cause &&
          typeof cause === "object" &&
          "message" in cause &&
          typeof (cause as PainelBilheteriaWorkstationError).message === "string"
            ? (cause as PainelBilheteriaWorkstationError).message
            : "Nao foi possivel consultar este ingresso agora.";
      }
    }

    initialTicketLookupState = {
      isOpen: true,
      lookup,
      result,
      error,
    };
  }

  return (
    <div className="grid gap-5">
      <PainelBilheteriaPageHeader
        current="overview"
        isManager={session.legacyRoleId === 1}
        title="Bilheteria"
        description="Posto operacional da bilheteria, com validacao por voucher, consulta por cliente e consulta rapida do historico."
        actorName={session.actorName}
      />

      {hasOpenAgendaToday ? (
        <PainelBilheteriaWorkstation
          actorName={session.actorName}
          actorCpf={session.actorCpf}
          isManager={session.legacyRoleId === 1}
          initialTicketLookupState={initialTicketLookupState}
        />
      ) : (
        <section className="panel-section p-6">
          <p className="panel-eyebrow">Bilheteria</p>
          <h2 className="mt-2 text-[34px] font-black leading-tight text-[#17351f]">
            Agenda nao aberta
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-[#5f7564]">
            A bilheteria so fica ativa quando existe agenda aberta para hoje.
          </p>
        </section>
      )}
    </div>
  );
}
