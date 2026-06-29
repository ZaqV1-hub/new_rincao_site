import { getPublicAgendaEvents } from "@/lib/agenda-repository";

function getSaoPauloToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
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
