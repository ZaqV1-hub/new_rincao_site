import { notFound } from 'next/navigation';
import { requirePainelAccess } from '@/lib/painel-session';
import { getSaoPauloToday,isCivilDate } from '@/lib/operational-date';
import { CountingDayPage } from '@/components/counting-day-page';
export default async function Page({ params,searchParams }: { params: Promise<{ agendaId: string; clientId: string }>; searchParams: Promise<{ date?: string }> }) {
  const ids = await params,query = await searchParams;
  const agendaId = Number(ids.agendaId),clientId = Number(ids.clientId);
  if (![agendaId,clientId].every(id => Number.isSafeInteger(id) && id > 0)) notFound();
  const session = await requirePainelAccess('vis_contagem',`/contagem/passeios/${agendaId}/${clientId}`);
  const date = query.date && isCivilDate(query.date) ? query.date : getSaoPauloToday();
  return <CountingDayPage key={`${date}:${agendaId}:${clientId}`} date={date} manager={session.legacyRoleId === 1} actorCpf={session.actorCpf ?? ''} trip={{ agendaId,clientId }}/>;
}
