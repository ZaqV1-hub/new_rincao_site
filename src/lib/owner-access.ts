import {getOperationalCatalogPool} from './painel-operational-catalog';
import {hashPasswordForLegacyUser} from './password-hashing';
import {ownerCookieFromRequest,verifyOwnerSessionToken} from './owner-session';
import type {OwnerPark} from './owner-dashboard';
export type OwnerAccess={cpf:string;name:string;parks:OwnerPark[]};
type AccessRow={cpf:string;name:string;parks:string[]};
function access(row?:AccessRow):OwnerAccess|null{
 if(!row||!Array.isArray(row.parks)||!row.parks.length||row.parks.some(p=>!['rincao','estancia'].includes(p)))return null;
 return {cpf:row.cpf,name:row.name,parks:[...new Set(row.parks)] as OwnerPark[]};
}
const select=`SELECT u.cpf,u.nmusuario AS name,a.parques AS parks FROM painel_donos_acessos a JOIN usuario u ON u.cpf=a.cpf WHERE a.ativo AND u.stusuario='ati'`;
export async function authenticateOwner(login:string,password:string){
 const email=login.includes('@');const normalized=email?login.trim().toLowerCase():login.replace(/\D/g,'');
 if(!normalized||normalized.length>254||(!email&&!/^\d{11}$/.test(normalized))||password.length<1||password.length>20)return null;
 const rows=(await getOperationalCatalogPool().query<AccessRow>(`${select} AND ${email?'lower(u.email)':'u.cpf'}=$1 AND u.senha=$2 LIMIT 2`,[normalized,hashPasswordForLegacyUser(password)])).rows;
 return rows.length===1?access(rows[0]):null;
}
export async function ownerAccessForToken(token?:string|null){
 const session=verifyOwnerSessionToken(token);if(!session)return null;
 return access((await getOperationalCatalogPool().query<AccessRow>(`${select} AND u.cpf=$1`,[session.cpf])).rows[0]);
}
export async function requireOwner(request:Request){return ownerAccessForToken(ownerCookieFromRequest(request));}
export function ownerPrivate(response:Response){response.headers.set('Cache-Control','private, no-store');response.headers.set('X-Content-Type-Options','nosniff');return response;}
