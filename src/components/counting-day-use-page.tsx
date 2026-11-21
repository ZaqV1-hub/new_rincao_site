'use client';
import { useEffect,useRef,useState } from 'react';
import { CountingQrIcon } from './counting-qr-icon';
import { getSaoPauloToday } from '@/lib/operational-date';
import type { CountingAttendance } from '@/lib/counting-attendance';
import { useCountingRead,countingButton,countingBlue,countingInput } from './counting-controls';
type Attempt = { code: string; date: string; idempotencyKey: string; confirmExpired?: boolean };
type Preview = { attempt: Attempt; number: string; category: string; expired: boolean; expiredOn: string | null };
const ticketCategories: Record<string, string> = { norma: 'Adulto', infan: 'Criança', isent: 'Isento', corte: 'Cortesia' };
const displayDate = (date: string) => date.split('-').reverse().join('/');

function admissionError(error: { message?: string; details?: { validation?: { actorName?: string; date?: string; time?: string; locationName?: string } } } | undefined) {
  const validation = error?.details?.validation;
  if (!validation) return error?.message ?? 'Entrada não autorizada.';
  const date = validation.date ? displayDate(validation.date) : 'data não registrada';
  const operator = validation.actorName ? ` · ${validation.actorName}` : '';
  const location = validation.locationName ? ` · ${validation.locationName}` : '';
  return `Ingresso já utilizado em ${date} ${validation.time?.slice(0, 8) ?? ''}${operator}${location}.`;
}
export function CountingDayUsePage({date,actorCpf}:{date:string;actorCpf:string}){
  const {data,error,refresh}=useCountingRead<CountingAttendance>(`/api/contagem/dias/${date}/entradas`);
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),active=useRef(false),generation=useRef(0),starting=useRef(false),locked=useRef(false);
  const [camera,setCamera]=useState(false),[code,setCode]=useState(''),[message,setMessage]=useState(''),[resultState,setResultState]=useState<'accepted'|'rejected'|'pending'>('pending'),[pending,setPending]=useState<Attempt|null>(null),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const isToday=date===getSaoPauloToday();
  const storage=`rincao:gate:${actorCpf}`;
  function stop(){generation.current++;starting.current=false;active.current=false;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setCamera(false);}
  useEffect(()=>{const timer=setTimeout(()=>{try{const saved=sessionStorage.getItem(storage);if(saved){const value=JSON.parse(saved);if(typeof value.code!=='string'||typeof value.idempotencyKey!=='string'||typeof value.date!=='string')throw new Error();setPending(value);setMessage('Confira a entrada anterior antes de ler outro ingresso.');}setReady(true);}catch{setMessage('Não foi possível recuperar a tentativa. Peça conferência à portaria.');}},0);return()=>clearTimeout(timer);},[storage]);
  useEffect(()=>{const generations=generation;const hidden=()=>{if(document.hidden){generation.current++;starting.current=false;active.current=false;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setCamera(false);}};document.addEventListener('visibilitychange',hidden);return()=>{document.removeEventListener('visibilitychange',hidden);generations.current++;starting.current=false;active.current=false;stream.current?.getTracks().forEach(t=>t.stop());};},[]);
  function clearAttempt(attempt:Attempt){const stored=sessionStorage.getItem(storage);if(stored&&JSON.parse(stored).idempotencyKey===attempt.idempotencyKey)sessionStorage.removeItem(storage);}
  async function inspect(value: string) {
    if (locked.current || !ready || !isToday || pending) return;
    locked.current = true;
    setBusy(true);
    stop();
    setPreview(null);
    setMessage('');
    const attempt = { code: value, date, idempotencyKey: crypto.randomUUID() };
    try {
      const response = await fetch('/api/contagem/entradas?preview=1', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt), signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (response.ok && body.ok) {
        setPreview({ ...body.data, attempt: { ...attempt, confirmExpired: body.data.expired === true } });
      } else {
        setResultState('rejected');
        setMessage(admissionError(body.error));
      }
    } catch {
      setResultState('rejected');
      setMessage('Não foi possível consultar o ingresso. Tente ler o código novamente.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function admit(attempt: Attempt) {
    if (locked.current || !ready) return;
    locked.current = true;
    setBusy(true);
    stop();
    setPreview(null);
    setMessage('');
    setResultState('pending');
    try {
      sessionStorage.setItem(storage,JSON.stringify(attempt));setPending(attempt);
      const response=await fetch('/api/contagem/entradas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt),signal:AbortSignal.timeout(15000)}),body=await response.json();
      if(response.ok&&body.ok){clearAttempt(attempt);setPending(null);setResultState(body.data.replayed?'pending':'accepted');setMessage(`${body.data.replayed?'Registro anterior confirmado; isto não libera uma nova entrada':'Entrada liberada'} · ${ticketCategories[body.data.category]??body.data.category} · compra ${body.data.purchaseId} · ${body.data.number} · ${body.data.actorName} · ${body.data.date} ${body.data.time}${body.data.warnings?.length?' · '+body.data.warnings.join(' '):''}`);setCode('');await refresh();}
      else if(response.status<500&&![401,403].includes(response.status)){clearAttempt(attempt);setPending(null);setResultState('rejected');setMessage(admissionError(body.error));}
      else setMessage(body.error?.message??'Resultado não confirmado. Confira a mesma tentativa.');
    }catch{setMessage('Não foi possível confirmar a entrada. Confira a mesma tentativa antes de liberar a pessoa.');}finally{locked.current=false;setBusy(false);}
  }
  async function start(){
    if(!isToday||locked.current||pending||!ready||starting.current||active.current)return;starting.current=true;const token=++generation.current;setPreview(null);setMessage('');setResultState('pending');
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error();
      const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      if(document.hidden||token!==generation.current){media.getTracks().forEach(t=>t.stop());return;}
      starting.current=false;stream.current=media;active.current=true;setCamera(true);
      if(video.current){video.current.srcObject=media;await video.current.play();}
      const {default:decode}=await import('jsqr'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
      const scan=()=>{if(token!==generation.current||!active.current||!video.current||!ctx)return;
        if(video.current.readyState>=2){const w=Math.min(640,video.current.videoWidth),h=Math.round(video.current.videoHeight*w/video.current.videoWidth);if(w&&h){canvas.width=w;canvas.height=h;ctx.drawImage(video.current,0,0,w,h);const image=ctx.getImageData(0,0,w,h),found=decode(image.data,w,h);if(found){void inspect(found.data);return;}}}
        setTimeout(scan,180);
      };scan();
    }catch{if(token!==generation.current)return;stop();setMessage('Não foi possível abrir a câmera. Confira a permissão ou digite o código do ingresso.');}
  }
  return <div className="space-y-5"><a href={`/contagem?date=${date}`} className="inline-flex min-h-11 items-center underline">← Voltar aos passeios</a><h1 className="text-2xl font-bold">Day use</h1><p>Leitura de QR Code · {date.split('-').reverse().join('/')}</p>
    <div className="grid grid-cols-3 rounded-2xl border border-[#d9e5ef] bg-white p-4 text-center">{[[data?.sold,'vendidos para a data'],[data?.admitted,'já lidos'],[data?.expected,'ainda previstos']].map(([n,label])=><div key={String(label)}><strong className="block text-2xl">{n??'—'}</strong><small>{label}</small></div>)}</div>
    {data&&data.admitted>data.sold&&<p>Já passou do previsto. A previsão não é limite de entrada.</p>}{error&&<p role="alert">{error}</p>}
    {!isToday && <p className="rounded-xl border border-[#d9e3ee] bg-white p-3">Esta data está disponível para consulta. A leitura de QR só está disponível hoje.</p>}
    {isToday && <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#143756] p-4 text-white"><video ref={video} muted playsInline className={`h-full w-full rounded-xl object-cover ${camera?'':'hidden'}`} aria-label="Câmera para ler QR Code"/>{!camera&&<div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-10 text-center"><CountingQrIcon className="h-12 w-12 text-[#8fb9e3]"/><p className="max-w-48 text-sm">Aponte a câmera para o QR Code do voucher</p></div>}<div aria-hidden="true" className="pointer-events-none absolute inset-[15%] rounded-xl border-2 border-white/80"/></div>}
    {message&&<p role="status" className={`rounded-xl border p-4 ${resultState==='accepted'?'border-green-700 bg-green-50 text-green-900':resultState==='rejected'?'border-red-700 bg-red-50 text-red-900':'border-amber-600 bg-amber-50 text-amber-950'}`}><strong className="mb-1 block">{resultState==='accepted'?'Entrada liberada':resultState==='rejected'?'Entrada não autorizada':'Confira antes de liberar'}</strong>{message}</p>}
    {preview && isToday && <section aria-label="Ingresso consultado" className="grid gap-3 rounded-2xl border border-[#d9e5ef] bg-white p-4">
      <div><strong className="block text-lg">{ticketCategories[preview.category] ?? preview.category}</strong><span>Ingresso {preview.number}</span></div>
      {preview.expired && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
        {preview.expiredOn ? `Este ingresso venceu em ${displayDate(preview.expiredOn)}.` : 'Este ingresso está vencido.'} Deseja validar mesmo assim, sem reagendar?
      </p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={countingBlue} disabled={busy} onClick={() => void admit(preview.attempt)}>{preview.expired ? 'Validar mesmo assim' : 'Validar ingresso'}</button>
        <button type="button" className={countingButton} disabled={busy} onClick={() => setPreview(null)}>Cancelar</button>
      </div>
    </section>}
    {pending?<button className={countingBlue} disabled={busy} onClick={()=>void admit(pending)}>Conferir a mesma tentativa</button>:isToday&&<button className={`${countingBlue} gap-2`} disabled={busy||!ready} onClick={()=>camera?stop():void start()}>{!camera && <CountingQrIcon className="h-5 w-5"/>}{camera?'Parar câmera':'Ler QR Code'}</button>}
    {isToday && <form className="grid gap-3" onSubmit={e=>{e.preventDefault();void inspect(code);}}><label className="grid gap-2">Código do ingresso<input className={countingInput} value={code} onChange={e=>{setCode(e.target.value);setPreview(null);}} maxLength={100} autoComplete="off" required disabled={busy||!!pending}/></label><button className={countingButton} disabled={busy||!!pending||!ready}>Consultar código</button></form>}
  </div>;
}
