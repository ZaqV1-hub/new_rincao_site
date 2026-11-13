import {requirePainelAccess} from '@/lib/painel-session';
import {getSaoPauloToday,isCivilDate} from '@/lib/operational-date';
import {CountingDayReports} from '@/components/counting-day-reports';
export default async function Page({searchParams}:{searchParams:Promise<{date?:string}>}){const session=await requirePainelAccess('vis_contagem','/contagem/relatorios'),q=await searchParams;return <CountingDayReports date={q.date&&isCivilDate(q.date)?q.date:getSaoPauloToday()} actorCpf={session.actorCpf??''}/>;}
