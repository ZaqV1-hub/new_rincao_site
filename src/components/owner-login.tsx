'use client';
import Script from 'next/script';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {resolveRecaptchaToken} from './painel-login-page';
import styles from './owner-dashboard.module.css';
export function OwnerLogin({siteKey,initialError=''}:{siteKey:string|null;initialError?:string}){
 const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState(initialError);
 return <main className={styles.shell}><section className={styles.login}>
  {siteKey&&<Script src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`}/>}
  <p className={styles.eyebrow}>Rincão + Estância</p><h1>Painel dos donos</h1><p>Resultados dos parques, em um só lugar. Acesso somente para consulta.</p>
  <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const form=new FormData(e.currentTarget);try{
   const recaptchaToken=siteKey?await resolveRecaptchaToken(siteKey):'';
   const r=await fetch('/api/donos/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:form.get('login'),password:form.get('password'),recaptchaToken})});const data=await r.json();
   if(!r.ok||!data.ok)throw new Error(data.error?.message||'Não foi possível entrar.');router.refresh();
  }catch(err){setError(err instanceof Error&&!['recaptcha_not_loaded','Failed to fetch'].includes(err.message)?err.message:'Não foi possível validar o acesso. Aguarde e tente novamente.');}finally{setBusy(false);}}}>
   <label>CPF ou e-mail<input name="login" autoComplete="username" maxLength={254} required/></label>
   <label>Senha<input name="password" type="password" autoComplete="current-password" maxLength={20} required/></label>
   {error&&<p role="alert">{error}</p>}<button disabled={busy}>{busy?'Entrando…':'Entrar'}</button>
  </form>
 </section></main>;
}
