'use client';
import {useEffect,useState} from 'react';
import {OperationalDialog} from './operational-dialog';
import {countingButton,countingPrimary} from './counting-controls';
import type {CountingWhatsappStatus} from '@/lib/counting-whatsapp';

export function CountingWhatsapp({url,phone}:{url:string;phone:string}){
 const [confirming,setConfirming]=useState(false);
 const [enabled,setEnabled]=useState(false),[attempt,setAttempt]=useState<CountingWhatsappStatus|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;void fetch(url).then(async response=>{if(!response.ok)return;const result=await response.json();if(active&&result.ok){setEnabled(result.data.enabled);setAttempt(result.data.attempt);}}).catch(()=>undefined);return()=>{active=false;};},[url]);
 async function send(){
  setConfirming(false);
  setBusy(true);setMessage('');
  try{const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),result=await response.json();if(!response.ok||!result.ok){setMessage(result.error?.message??'Não foi possível confirmar o envio.');return;}setAttempt(result.data);}
  catch{setMessage('Não foi possível confirmar o envio. Recarregue para conferir o registro antes de tentar novamente.');}
  finally{setBusy(false);}
 }
 if(!enabled)return null;
 return <div className="space-y-2 rounded-xl border border-[#d9e3ee] p-3"><p className="text-sm">Enviar pelo WhatsApp do Rincão para {phone}.</p>
 <button className={countingPrimary} disabled={busy||!!attempt} onClick={()=>setConfirming(true)}>{busy?'Enviando…':attempt?'Envio já solicitado':'Enviar filipeta pelo WhatsApp'}</button>
 {attempt&&<p role="status" className="text-sm">{attempt.status==='accepted'?`${attempt.accepted} de ${attempt.pages} página(s) aceita(s) pela Meta. A entrega ao aparelho ainda não está confirmada.`:attempt.status==='sending'?'Solicitação registrada. Recarregue para conferir o resultado. Não repita o envio manualmente sem conferir o destinatário.':`${attempt.accepted} de ${attempt.pages} página(s) aceita(s) pela Meta. ${attempt.status==='uncertain'?'Resultado restante incerto.':'Não foi possível concluir o envio.'} Confira o WhatsApp antes de compartilhar manualmente.`}</p>}
 {confirming&&<OperationalDialog sheet title="Enviar filipeta pelo WhatsApp?" onClose={()=>setConfirming(false)}><p className="mb-4 text-sm">Confira o número do responsável: {phone}. O envio será feito pelo WhatsApp do Rincão.</p><button className={`${countingPrimary} w-full`} onClick={()=>void send()}>Confirmar envio</button><button className={`${countingButton} mt-2 w-full`} onClick={()=>setConfirming(false)}>Cancelar</button></OperationalDialog>}
 {message&&<p role="status" className="text-sm">{message}</p>}
 </div>;
}
