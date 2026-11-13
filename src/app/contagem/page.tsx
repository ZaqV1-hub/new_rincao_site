import { CountingDayPage } from '@/components/counting-day-page';
import { requirePainelAccess } from '@/lib/painel-session';
import { isCivilDate,getSaoPauloToday } from '@/lib/operational-date';
export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await requirePainelAccess('vis_contagem','/contagem'),query = await searchParams;
  const date = query.date && isCivilDate(query.date) ? query.date : getSaoPauloToday();
  return <CountingDayPage date={date} manager={session.legacyRoleId === 1} actorCpf={session.actorCpf ?? ''}/>;
}
