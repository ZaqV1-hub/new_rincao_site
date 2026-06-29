import type { Metadata } from "next";
import { PainelBilheteriaPageHeader } from "@/components/painel-bilheteria-page-header";
import { PainelBilheteriaWorkstation } from "@/components/painel-bilheteria-workstation";
import { getBilheteriaAgendaStatusToday } from "@/lib/bilheteria-agenda";
import {
  lookupPainelBilheteriaTicketByVoucherId,
  type PainelBilheteriaTicketLookupResult,
  type PainelBilheteriaWorkstationError,
} from "@/lib/painel-bilheteria-workstation";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Bilheteria | Rincao",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

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
  const { hasOpenAgendaToday } = await getBilheteriaAgendaStatusToday();
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

      {!hasOpenAgendaToday ? (
        <section className="panel-section p-6">
          <p className="panel-eyebrow">Bilheteria</p>
          <h2 className="mt-2 text-[34px] font-black leading-tight text-[#123b63]">
            Agenda nao aberta
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-[#5d7282]">
            Sem uma agenda aberta para hoje, a validacao e a venda ficam bloqueadas. Historicos e consultas administrativas continuam disponiveis.
          </p>
        </section>
      ) : null}

      <PainelBilheteriaWorkstation
        actorName={session.actorName}
        actorCpf={session.actorCpf}
        isManager={session.legacyRoleId === 1}
        initialTicketLookupState={initialTicketLookupState}
        agendaOpen={hasOpenAgendaToday}
        agendaWarning={
          hasOpenAgendaToday
            ? null
            : "Nao existe agenda aberta para hoje. Validacao de ingresso e venda ficam indisponiveis ate abrir uma data."
        }
      />
    </div>
  );
}

