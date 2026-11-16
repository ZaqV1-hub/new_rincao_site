'use client';
import { useEffect,useRef,useState } from 'react';
import { getSaoPauloToday } from '@/lib/operational-date';
import type { CountingAttendance } from '@/lib/counting-attendance';
import { useCountingRead,countingButton,countingInput,countingPrimary } from './counting-controls';
type Attempt={code:string;date:string;idempotencyKey:string};
export function CountingDayUsePage({date,actorCpf}:{date:string;actorCpf:string}){
  const {data,error,refresh}=useCountingRead<CountingAttendance>(`/api/contagem/dias/${date}/entradas`);
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),active=useRef(false),generation=useRef(0),starting=useRef(false),locked=useRef(false);
  const [camera,setCamera]=useState(false),[code,setCode]=useState(''),[message,setMessage]=useState(''),[resultState,setResultState]=useState<'accepted'|'rejected'|'pending'>('pending'),[pending,setPending]=useState<Attempt|null>(null),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
  const isToday=date===getSaoPauloToday();
  const storage=`rincao:gate:${actorCpf}`;
  function stop(){generation.current++;starting.current=false;active.current=false;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setCamera(false);}
  useEffect(()=>{const timer=setTimeout(()=>{try{const saved=sessionStorage.getItem(storage);if(saved){const value=JSON.parse(saved);if(typeof value.code!=='string'||typeof value.idempotencyKey!=='string'||typeof value.date!=='string')throw new Error();setPending(value);setMessage('Confira a entrada anterior antes de ler outro ingresso.');}setReady(true);}catch{setMessage('Não foi possível recuperar a tentativa. Peça conferência à portaria.');}},0);return()=>clearTimeout(timer);},[storage]);
  useEffect(()=>{const generations=generation;const hidden=()=>{if(document.hidden){generation.current++;starting.current=false;active.current=false;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setCamera(false);}};document.addEventListener('visibilitychange',hidden);return()=>{document.removeEventListener('visibilitychange',hidden);generations.current++;starting.current=false;active.current=false;stream.current?.getTracks().forEach(t=>t.stop());};},[]);
  function clearAttempt(attempt:Attempt){const stored=sessionStorage.getItem(storage);if(stored&&JSON.parse(stored).idempotencyKey===attempt.idempotencyKey)sessionStorage.removeItem(storage);}
  async function admit(value:string,existing?:Attempt){
    if(locked.current||!ready||(!existing&&(!isToday||pending)))return;locked.current=true;setBusy(true);stop();setResultState('pending');
    const attempt=existing??{code:value,date,idempotencyKey:crypto.randomUUID()};
    try{
      sessionStorage.setItem(storage,JSON.stringify(attempt));setPending(attempt);
      const response=await fetch('/api/contagem/entradas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt),signal:AbortSignal.timeout(15000)}),body=await response.json();
      if(response.ok&&body.ok){clearAttempt(attempt);setPending(null);setResultState(body.data.replayed?'pending':'accepted');setMessage(`${body.data.replayed?'Registro anterior confirmado; isto não libera uma nova entrada':'Entrada liberada'} · ${({norma:'Adulto',infan:'Criança',isent:'Isento',corte:'Cortesia'} as Record<string,string>)[body.data.category]??body.data.category} · compra ${body.data.purchaseId} · ${body.data.number} · ${body.data.actorName} · ${body.data.date} ${body.data.time}${body.data.warnings?.length?' · '+body.data.warnings.join(' '):''}`);setCode('');await refresh();}
      else if(response.status<500&&![401,403].includes(response.status)){clearAttempt(attempt);setPending(null);setResultState('rejected');const detail=body.error?.details?.validation;setMessage(`${body.error?.message??'Entrada não autorizada.'}${detail?` Por: ${detail.actorName??'não registrado'} · ${detail.date??''} ${detail.time??''}.`:''}`);}
      else setMessage(body.error?.message??'Resultado não confirmado. Confira a mesma tentativa.');
    }catch{setMessage('Não foi possível confirmar a entrada. Confira a mesma tentativa antes de liberar a pessoa.');}finally{locked.current=false;setBusy(false);}
  }
  async function start(){
    if(!isToday||locked.current||pending||!ready||starting.current||active.current)return;starting.current=true;const token=++generation.current;setMessage('');setResultState('pending');
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error();
      const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      if(document.hidden||token!==generation.current){media.getTracks().forEach(t=>t.stop());return;}
      starting.current=false;stream.current=media;active.current=true;setCamera(true);
      if(video.current){video.current.srcObject=media;await video.current.play();}
      const {default:decode}=await import('jsqr'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
      const scan=()=>{if(token!==generation.current||!active.current||!video.current||!ctx)return;
        if(video.current.readyState>=2){const w=Math.min(640,video.current.videoWidth),h=Math.round(video.current.videoHeight*w/video.current.videoWidth);if(w&&h){canvas.width=w;canvas.height=h;ctx.drawImage(video.current,0,0,w,h);const image=ctx.getImageData(0,0,w,h),found=decode(image.data,w,h);if(found){void admit(found.data);return;}}}
        setTimeout(scan,180);
      };scan();
    }catch{if(token!==generation.current)return;stop();setMessage('Não foi possível abrir a câmera. Confira a permissão ou digite o código do ingresso.');}
  }
  return <div className="space-y-5"><a href={`/contagem?date=${date}`} className="inline-flex min-h-11 items-center underline">← Voltar aos passeios</a><h1 className="text-2xl font-bold">Day use</h1><p>Leitura de QR Code · {date.split('-').reverse().join('/')}</p>
    <div className="grid grid-cols-3 rounded-2xl border border-[#d9e5ef] bg-white p-4 text-center">{[[data?.sold,'vendidos para a data'],[data?.admitted,'já lidos'],[data?.expected,'ainda previstos']].map(([n,label])=><div key={String(label)}><strong className="block text-2xl">{n??'—'}</strong><small>{label}</small></div>)}</div>
    {data&&data.admitted>data.sold&&<p>Já passou do previsto. A previsão não é limite de entrada.</p>}{error&&<p role="alert">{error}</p>}
    {!isToday && <p className="rounded-xl border border-[#d9e3ee] bg-white p-3">Esta data está disponível para consulta. A leitura de QR só está disponível hoje.</p>}
    {isToday && <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#143756] p-4 text-white"><video ref={video} muted playsInline className={`h-full w-full rounded-xl object-cover ${camera?'':'hidden'}`} aria-label="Câmera para ler QR Code"/>{!camera&&<p className="py-16 text-center">Aponte a câmera para o QR Code do voucher</p>}<div aria-hidden="true" className="pointer-events-none absolute inset-[15%] rounded-xl border-2 border-white/80"/></div>}
    {message&&<p role="status" className={`rounded-xl border p-4 ${resultState==='accepted'?'border-green-700 bg-green-50 text-green-900':resultState==='rejected'?'border-red-700 bg-red-50 text-red-900':'border-amber-600 bg-amber-50 text-amber-950'}`}><strong className="mb-1 block">{resultState==='accepted'?'Entrada liberada':resultState==='rejected'?'Entrada não autorizada':'Confira antes de liberar'}</strong>{message}</p>}
    {pending?<button className={countingPrimary} disabled={busy} onClick={()=>void admit(pending.code,pending)}>Conferir a mesma tentativa</button>:isToday&&<button className={countingPrimary} disabled={busy||!ready} onClick={()=>camera?stop():void start()}>{camera?'Parar câmera':'Ler QR Code'}</button>}
    {isToday && <form className="grid gap-3" onSubmit={e=>{e.preventDefault();void admit(code);}}><label className="grid gap-2">Código do ingresso<input className={countingInput} value={code} onChange={e=>setCode(e.target.value)} maxLength={100} autoComplete="off" required disabled={busy||!!pending}/></label><button className={countingButton} disabled={busy||!!pending||!ready}>Validar código</button></form>}
  </div>;
}
