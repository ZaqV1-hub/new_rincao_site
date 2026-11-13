import { requirePainelAccess } from '@/lib/painel-session';
import { getSaoPauloToday } from '@/lib/operational-date';
import { CountingDayUsePage } from '@/components/counting-day-use-page';
export default async function Page(){const session=await requirePainelAccess('vis_portaria','/contagem/day-use');return <CountingDayUsePage date={getSaoPauloToday()} actorCpf={session.actorCpf??''}/>;}
