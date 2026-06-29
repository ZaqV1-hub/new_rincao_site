import { getPublicAgendaEvents } from "@/lib/agenda-repository";

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

function isBilheteriaAgendaOpen(status: string | null | undefined) {
  return status === "abe" || status === "lot";
}

export async function getBilheteriaAgendaStatusToday() {
  const today = getSaoPauloToday();
  const [year, month] = today.split("-").map(Number);
  const agendas = await getPublicAgendaEvents(month, year);
  const openAgendas = agendas.filter(
    (agenda) => agenda.date === today && isBilheteriaAgendaOpen(agenda.status),
  );

  return {
    today,
    hasOpenAgendaToday: openAgendas.length > 0,
    openAgendas,
  };
}
