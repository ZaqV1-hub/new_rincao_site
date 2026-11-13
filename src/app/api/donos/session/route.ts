import {NextResponse} from 'next/server';
import {authenticateOwner,ownerPrivate} from '@/lib/owner-access';
import {createOwnerSessionToken,setOwnerCookie,ownerRequestSameOrigin} from '@/lib/owner-session';
import {isRecaptchaEnabled,verifyRecaptchaToken} from '@/lib/recaptcha';
import {readTripFinancialBody} from '@/lib/trip-settlement-route';
export const runtime='nodejs';
function error(message:string,status:number){return ownerPrivate(NextResponse.json({ok:false,error:{message}},{status}));}

export async function POST(request:Request){
 if(!ownerRequestSameOrigin(request))return error('Solicitação inválida.',403);
 let input:Record<string,unknown>;
 try{input=await readTripFinancialBody(request) as Record<string,unknown>;if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['login','password','recaptchaToken'].includes(k))||typeof input.login!=='string'||typeof input.password!=='string'||input.login.length>254||input.password.length>20)throw new Error();}catch{return error('Dados de acesso inválidos.',400);}
 try{
  if(process.env.NODE_ENV==='production'&&!isRecaptchaEnabled())return error('A proteção do acesso ainda não foi configurada.',503);
  const captcha=await verifyRecaptchaToken({token:typeof input.recaptchaToken==='string'?input.recaptchaToken:'',action:'login'});
  if(!captcha.ok)return error(captcha.message,400);
  const user=await authenticateOwner(input.login as string,input.password as string);if(!user)return error('Login ou senha inválidos, ou conta sem acesso a este painel.',401);
  const response=NextResponse.json({ok:true});setOwnerCookie(response,createOwnerSessionToken(user.cpf));return ownerPrivate(response);
 }catch{console.warn('[owners] authentication unavailable');return error('Não foi possível entrar agora.',503);}
}
export async function DELETE(request:Request){
 if(!ownerRequestSameOrigin(request))return error('Solicitação inválida.',403);
 const response=NextResponse.json({ok:true});setOwnerCookie(response,null);return ownerPrivate(response);
}
