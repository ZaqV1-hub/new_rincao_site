import React from 'react';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { CountingDayPage } from './counting-day-page';
import { CountingDayReports } from './counting-day-reports';
import { CountingDayUsePage } from './counting-day-use-page';
import { CountingShare } from './counting-share';
import { CountingSignature,hasCountingSignatureInk } from './counting-signature';
import type { CountingDay } from '@/lib/trip-counting';
import { getSaoPauloToday } from '@/lib/operational-date';
import type { CountingDayClosure } from '@/lib/counting-day-closure';
import type { CountingResult } from '@/lib/trip-counting-contract';

type Bank={slots:unknown[];cursor:number;effects:(()=>void)[]};
type Command={submit:ReturnType<typeof vi.fn>;confirmed:(result:CountingResult)=>Promise<void>;pending:null;blocked:boolean;ready:boolean;busy:boolean;message:string};
const hooks=vi.hoisted(()=>({active:null as Bank|null,read:vi.fn(),push:vi.fn(),json:vi.fn(),commands:new Map<string,Command>()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:hooks.push})}));
vi.mock('@/lib/trip-counting-client',()=>({readCountingJson:hooks.json}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),
 useState(initial:unknown){const b=hooks.active!,i=b.cursor++;if(!(i in b.slots))b.slots[i]=typeof initial==='function'?initial():initial;return[b.slots[i],(next:unknown)=>{b.slots[i]=typeof next==='function'?next(b.slots[i]):next;}];},
 useRef(initial:unknown){const b=hooks.active!,i=b.cursor++;if(!(i in b.slots))b.slots[i]={current:initial};return b.slots[i];},
 useEffect(run:()=>void){hooks.active!.cursor++;hooks.active!.effects.push(run);},
}));
vi.mock('./counting-controls',async original=>({...await original<typeof import('./counting-controls')>(),useCountingRead:hooks.read,useCountingLeaveWarning:()=>{},useCountingCommand:(key:string,confirmed:Command['confirmed'])=>{
 const command=hooks.commands.get(key)??{submit:vi.fn(),pending:null,blocked:false,ready:true,busy:false,message:'',confirmed};command.confirmed=confirmed;hooks.commands.set(key,command);return command;
}}));
type Node=React.ReactElement<Record<string,unknown>>;
function nodes(value:unknown):Node[]{if(Array.isArray(value))return value.flatMap(nodes);if(!React.isValidElement(value))return[];const node=value as Node;return[node,...nodes(node.props.children)];}
function plain(value:unknown):string{return Array.isArray(value)?value.map(plain).join(''):React.isValidElement(value)?plain((value as Node).props.children):typeof value==='string'||typeof value==='number'?String(value):'';}
function find(value:unknown,match:(node:Node)=>boolean){const n=nodes(value).find(match);if(!n)throw new Error('UI element not found');return n;}
function bank():Bank{return{slots:[],cursor:0,effects:[]};}
function render<T>(b:Bank,run:()=>T){hooks.active=b;b.cursor=0;b.effects=[];return run();}
function click(node:Node,event:unknown={}){return(node.props.onClick as (e:unknown)=>unknown)(event);}
async function effects(b:Bank){b.effects.forEach(run=>run());await vi.runOnlyPendingTimersAsync();}
const today=getSaoPauloToday(),memory=new Map<string,string>(),fetchMock=vi.fn();
function day():CountingDay{return{date:today,today,park:'rincao',closed:false,generatedAt:'',carriers:[],feed:[],groups:[{agendaId:1,clientId:2,clientName:'Escola Teste',groupType:'school',foodNotes:null,plannedPeople:40,transportName:'Transporte A',vehicleCounts:{planned:1,extra:0,waiting:1,counting:0,completed:0},vehicles:[{id:9,agendaId:1,clientId:2,date:today,clientName:'Escola Teste',type:'bus',plannedPeople:40,state:'waiting',version:3,addedOnDay:false,isExtra:false,ordinal:1,transportName:'Transporte A',groupType:'school',financiallyFinalized:false,currentRevision:null,lastCompletedRevision:null,total:null,draftSubtotal:null,ownerName:null,startedAt:null}]}]};}
function setupRead(data:unknown){hooks.read.mockImplementation((url:string)=>({data:url.endsWith('/entradas')?{admitted:5,sold:10,expected:5}:data,error:'',refresh:vi.fn().mockResolvedValue(data),checkedAt:''}));}
beforeEach(()=>{vi.useFakeTimers();hooks.commands.clear();hooks.push.mockReset();hooks.json.mockReset();fetchMock.mockReset();memory.clear();vi.stubGlobal('fetch',fetchMock);vi.stubGlobal('sessionStorage',{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('counting entry gestures',()=>{
 it('starts a free vehicle with its visible version only after the click, then navigates on confirmation',async()=>{
  setupRead(day());const b=bank(),tree=render(b,()=>CountingDayPage({date:today,manager:false,actorCpf:'actor'}));
  const command=hooks.commands.get(`rincao:count:start:actor:${today}`)!;expect(command.submit).not.toHaveBeenCalled();
  const preventDefault=vi.fn();click(find(tree,n=>n.type==='a'&&n.props.href==='/contagem/veiculos/9'),{preventDefault});
  expect(command.submit).toHaveBeenCalledWith('/api/contagem/veiculos/9/start',{version:3,reason:''});expect(preventDefault).toHaveBeenCalled();
  await command.confirmed({commandId:'command',vehicleId:9,version:4,state:'counting',revisionId:'revision',confirmedAt:new Date().toISOString()});expect(hooks.push).toHaveBeenCalledWith('/contagem/veiculos/9');
 });
 it('keeps financially finalized vehicles read-only at the entry gesture',()=>{const data=day();data.groups[0].vehicles[0].financiallyFinalized=true;setupRead(data);const tree=render(bank(),()=>CountingDayPage({date:today,manager:false,actorCpf:'actor'}));click(find(tree,n=>n.type==='a'&&n.props.href==='/contagem/veiculos/9'),{preventDefault:vi.fn()});expect(hooks.commands.get(`rincao:count:start:actor:${today}`)!.submit).not.toHaveBeenCalled();});
 it.each(['count','only'])('adds once and %s controls whether the confirmed vehicle starts',async mode=>{
  setupRead(day());const b=bank(),props={date:today,manager:false,actorCpf:'actor'};let tree=render(b,()=>CountingDayPage(props));click(find(tree,n=>n.type==='button'&&plain(n).includes('Chegou mais')));tree=render(b,()=>CountingDayPage(props));
  const form=find(tree,n=>n.type==='form'&&plain(n).includes('Só adicionar'));
  (form.props.onSubmit as (event:unknown)=>void)({preventDefault:vi.fn(),nativeEvent:{submitter:{getAttribute:()=>mode}}});
  const add=hooks.commands.get(`rincao:count:add:actor:${today}`)!;expect(add.submit).toHaveBeenCalledTimes(1);expect(add.submit.mock.calls[0][1]).toMatchObject({agendaId:1,clientId:2,type:'bus',plannedPeople:40});
  await add.confirmed({commandId:'command',vehicleId:10,version:1,state:'waiting',revisionId:null,confirmedAt:new Date().toISOString()});
  const start=hooks.commands.get(`rincao:count:start:actor:${today}`)!.submit;
  if(mode==='count')expect(start).toHaveBeenCalledWith('/api/contagem/veiculos/10/start',{version:1,reason:''});else expect(start).not.toHaveBeenCalled();
 });
 it('recovers add-and-count intent after reload without creating another vehicle',async()=>{setupRead(day());memory.set(`rincao:count:add-intent:actor:${today}`,'count');render(bank(),()=>CountingDayPage({date:today,manager:false,actorCpf:'actor'}));const add=hooks.commands.get(`rincao:count:add:actor:${today}`)!;await add.confirmed({commandId:'command',vehicleId:10,version:1,state:'waiting',revisionId:null,confirmedAt:new Date().toISOString()});expect(add.submit).not.toHaveBeenCalled();expect(hooks.commands.get(`rincao:count:start:actor:${today}`)!.submit).toHaveBeenCalledOnce();});
});

describe('sharing integrity',()=>{
 it.each([new Response('login',{status:401,headers:{'content-type':'text/html'}}),new Response('{}',{headers:{'content-type':'application/json'}}),new Response('',{headers:{'content-type':'image/png'}})])('does not advertise non-image or failed downloads as ready',async response=>{
  hooks.json.mockResolvedValue([{name:'slip.png',url:'/private/image'}]);fetchMock.mockResolvedValue(response);const b=bank(),props={text:'Filipeta',imagesUrl:'/images'};const tree=render(b,()=>CountingShare(props));click(find(tree,n=>n.type==='button'&&plain(n).startsWith('Preparar')));await vi.waitFor(()=>expect(fetchMock).toHaveBeenCalled());await vi.waitFor(()=>expect(plain(render(b,()=>CountingShare(props)))).toContain('Não foi possível preparar'));
  expect(plain(render(b,()=>CountingShare(props)))).not.toContain('Compartilhar imagens');
 });
 it('prepares an authenticated PNG and offers the real file share',async()=>{hooks.json.mockResolvedValue([{name:'slip.png',url:'/private/image'}]);fetchMock.mockResolvedValue(new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}}));const b=bank(),props={text:'Filipeta',imagesUrl:'/images'};click(find(render(b,()=>CountingShare(props)),n=>n.type==='button'&&plain(n).startsWith('Preparar')));await vi.waitFor(()=>expect(plain(render(b,()=>CountingShare(props)))).toContain('Imagens prontas'));expect(plain(render(b,()=>CountingShare(props)))).toContain('Compartilhar imagens');});
});

it('does not treat a stationary touch as a signature; a drawn stroke is published',()=>{
 const b=bank(),onChange=vi.fn(),tree=render(b,()=>CountingSignature({onChange,disabled:false})),canvas=find(tree,n=>n.type==='canvas');
 const surface={getBoundingClientRect:()=>({left:0,top:0,width:600,height:240}),setPointerCapture:vi.fn(),toDataURL:()=> 'data:image/png;base64,stroke',getContext:()=>({beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn()})};
 (canvas.props.ref as {current:unknown}).current=surface;const event={currentTarget:surface,clientX:20,clientY:20,pointerId:1};
 (canvas.props.onPointerDown as (e:unknown)=>void)(event);(canvas.props.onPointerUp as (e:unknown)=>void)(event);expect(onChange).not.toHaveBeenCalled();expect(plain(render(b,()=>CountingSignature({onChange,disabled:false})))).toContain('um toque sem traço');
 (canvas.props.onPointerDown as (e:unknown)=>void)(event);(canvas.props.onPointerUp as (e:unknown)=>void)({...event,clientX:40});expect(onChange).toHaveBeenCalledWith('data:image/png;base64,stroke');
});

it('lists pending vehicles and groups in the close dialog and preserves the exact request on retry',async()=>{
 const report={date:today,generatedAt:'',fingerprint:'snapshot-fingerprint',dayUse:{date:today,sold:5,admitted:2,expected:3},groups:[{agendaId:1,clientId:2,name:'Escola Teste',plannedPeople:40,transportName:'Transportador',foodNotes:null,slips:[],pending:[{vehicleId:9,label:'Ônibus 1',state:'counting'}]},{agendaId:1,clientId:3,name:'Grupo sem veículo',plannedPeople:null,transportName:null,foodNotes:null,slips:[],pending:[]}]};
 setupRead({date:today,closed:false,current:null,history:[],live:report,diverged:false} as CountingDayClosure);const b=bank(),props={date:today,actorCpf:'actor'};render(b,()=>CountingDayReports(props));await effects(b);let tree=render(b,()=>CountingDayReports(props));
 const modal=find(tree,n=>n.type==='dialog');expect(plain(modal)).toContain('Ônibus 1 · Escola Teste (contando)');expect(plain(modal)).toContain('Grupo sem veículo · sem veículos cadastrados');(modal.props.ref as {current:unknown}).current={close:vi.fn()};
 fetchMock.mockRejectedValue(new Error('network'));click(find(modal,n=>n.type==='button'&&plain(n)==='Finalizar mesmo assim'));await vi.waitFor(()=>expect(fetchMock).toHaveBeenCalledOnce());
 tree=render(b,()=>CountingDayReports(props));click(find(tree,n=>n.type==='button'&&plain(n)==='Conferir a mesma tentativa'));await vi.waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({action:'close',fingerprint:'snapshot-fingerprint',acknowledgePending:true});
});

it('keeps non-today QR pages read-only',()=>{setupRead(day());const tree=render(bank(),()=>CountingDayUsePage({date:'2099-01-01',actorCpf:'actor'}));expect(plain(tree)).toContain('disponível para consulta');expect(nodes(tree).some(n=>n.type==='video'||n.type==='form')).toBe(false);});

it('rejects empty, transparent, white and uniform signature pixels while retaining a visible stroke',()=>{
 expect(hasCountingSignatureInk(new Uint8ClampedArray())).toBe(false);
 expect(hasCountingSignatureInk(new Uint8ClampedArray([0,0,0,0,0,0,0,0]))).toBe(false);
 expect(hasCountingSignatureInk(new Uint8ClampedArray([255,255,255,255,255,255,255,255]))).toBe(false);
 expect(hasCountingSignatureInk(new Uint8ClampedArray([0,0,0,255,0,0,0,255]))).toBe(false);
 expect(hasCountingSignatureInk(new Uint8ClampedArray([20,40,60,255,0,0,0,0]))).toBe(true);
});

it('accepts a blue signature on ivory using the same channel contrast as the server',()=>{
 expect(hasCountingSignatureInk(new Uint8ClampedArray([18,59,99,255,255,255,240,255]))).toBe(true);
 expect(hasCountingSignatureInk(new Uint8ClampedArray([255,255,240,255,255,255,240,255]))).toBe(false);
});
