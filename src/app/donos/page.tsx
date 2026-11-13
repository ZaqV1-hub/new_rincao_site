import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import {ownerAccessForToken} from '@/lib/owner-access';
import {OWNER_COOKIE_NAME} from '@/lib/owner-session';
import {getRecaptchaSiteKey} from '@/lib/recaptcha';
import {OwnerLogin} from '@/components/owner-login';
import {OwnerDashboardPage} from '@/components/owner-dashboard';
import {readOwnerQuery} from '@/lib/owner-route';
import {getOwnerDashboard} from '@/lib/owner-sources';
import {ownerPeriod} from '@/lib/owner-dashboard';
import {getSaoPauloToday} from '@/lib/operational-date';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Painel dos donos | Rincão e Estância',robots:{index:false,follow:false}};
export default async function OwnersPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 let access;try{access=await ownerAccessForToken((await cookies()).get(OWNER_COOKIE_NAME)?.value);}catch{return <OwnerLogin siteKey={getRecaptchaSiteKey()||null} initialError="A consulta de acesso está indisponível. Tente novamente em instantes."/>;}
 if(!access)return <OwnerLogin siteKey={getRecaptchaSiteKey()||null}/>;
 const raw=await searchParams;const params=new URLSearchParams();for(const [k,v] of Object.entries(raw)){if(Array.isArray(v))v.forEach(s=>params.append(k,s));else if(v!==undefined)params.set(k,v);}
 let query;let error='';try{query=readOwnerQuery(params,access.parks);}catch{query={period:ownerPeriod('day',getSaoPauloToday()),parks:access.parks};error='Filtro inválido. Exibindo o dia atual.';}
 return <OwnerDashboardPage data={await getOwnerDashboard(query.period,query.parks)} name={access.name} allowedParks={access.parks} error={error}/>;
}
