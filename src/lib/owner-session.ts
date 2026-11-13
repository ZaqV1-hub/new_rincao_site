import {createHmac,timingSafeEqual} from 'node:crypto';
import type {NextResponse} from 'next/server';
export const OWNER_COOKIE_NAME='rincao_owner_session';
const ttl=8*60*60;
function signature(payload:string){
 const secret=process.env.OWNER_SESSION_SECRET||process.env.INGRESSO_OPERATIONS_SESSION_SECRET||process.env.INGRESSO_BFF_SESSION_SECRET;
 if(!secret&&process.env.NODE_ENV==='production')throw new Error('Owner session secret unavailable');
 return createHmac('sha256',secret||'local-owner-session-secret').update(`owners:${payload}`).digest('base64url');
}
export function createOwnerSessionToken(cpf:string){
 if(!/^\d{11}$/.test(cpf))throw new Error('Invalid owner identity');
 const now=Math.floor(Date.now()/1000);const payload=Buffer.from(JSON.stringify({v:1,scope:'owners',cpf,iat:now,exp:now+ttl})).toString('base64url');
 return `${payload}.${signature(payload)}`;
}
export function verifyOwnerSessionToken(token?:string|null):{cpf:string}|null{
 if(!token||token.length>2048)return null;
 const parts=token.split('.');if(parts.length!==2)return null;
 const [payload,sig]=parts;const expected=signature(payload);if(!/^[A-Za-z0-9_-]{43}$/.test(sig)||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
 try{const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')),now=Math.floor(Date.now()/1000);
  if(data.v!==1||data.scope!=='owners'||typeof data.cpf!=='string'||!/^\d{11}$/.test(data.cpf)||!Number.isInteger(data.iat)||!Number.isInteger(data.exp)||data.iat>now||data.exp<=now||data.exp-data.iat!==ttl)return null;
  return {cpf:data.cpf};
 }catch{return null;}
}
export function ownerCookieFromRequest(request:Request){return (request.headers.get('cookie')||'').split(';').map(p=>p.trim()).find(p=>p.startsWith(`${OWNER_COOKIE_NAME}=`))?.slice(OWNER_COOKIE_NAME.length+1);}
export function setOwnerCookie(response:NextResponse,token:string|null){response.cookies.set(OWNER_COOKIE_NAME,token??'',{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:token?ttl:0});}

export function ownerRequestSameOrigin(request:Request){
 try{const raw=request.headers.get('origin');if(!raw)return false;const origin=new URL(raw),host=request.headers.get('host')||new URL(request.url).host;
  return ['http:','https:'].includes(origin.protocol)&&origin.origin===raw&&origin.host===new URL(`${origin.protocol}//${host}`).host;
 }catch{return false;}
}
