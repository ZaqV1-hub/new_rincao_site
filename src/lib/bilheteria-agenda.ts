import { Buffer } from "node:buffer";
import { normalizeAgendaStatus, type PublicAgendaEvent } from "@/lib/agenda-contracts";
import { getPainelAgendaDay } from "@/lib/painel-agenda";

function getSaoPauloToday() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return `${valueByType.get("year")}-${valueByType.get("month")}-${valueByType.get("day")}`;
}

function encodeLegacyId(id: number) {
  return Buffer.from(String(id), "utf8").toString("base64");
}

function mapPainelAgendaToPublicAgenda(agenda: NonNullable<Awaited<ReturnType<typeof getPainelAgendaDay>>["agenda"]>): PublicAgendaEvent {
  return {
    id: agenda.id,
    legacyEncodedId: encodeLegacyId(agenda.id),
    date: agenda.date,
    day: agenda.day,
    month: agenda.month,
    year: agenda.year,
    type: agenda.type === "promo" ? "promo" : "padra",
    status: agenda.status === "lot" ? "lot" : "abe",
    statusLabel: normalizeAgendaStatus(agenda.status === "lot" ? "lot" : "abe"),
    priceTable: {
      id: agenda.priceTableId,
      name: agenda.priceTableName,
      normal: agenda.normalValue,
      child: agenda.childValue,
      gateNormal: null,
      gateChild: null,
    },
    promotional: {
      name: agenda.promotionName,
      description: agenda.promotionDescription,
    },
  };
}

export async function getBilheteriaAgendaStatusToday() {
  const today = getSaoPauloToday();
  const selectedDay = await getPainelAgendaDay(today);
  const agenda = selectedDay.agenda;
  const hasOpenAgendaToday =
    agenda != null && (agenda.status === "abe" || agenda.status === "lot");

  return {
    today,
    hasOpenAgendaToday,
    openAgendas: hasOpenAgendaToday && agenda ? [mapPainelAgendaToPublicAgenda(agenda)] : [],
  };
}
