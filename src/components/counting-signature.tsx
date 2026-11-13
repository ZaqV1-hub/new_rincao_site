'use client';
import { useRef,useState,type PointerEvent } from 'react';
import { countingButton,countingInput } from './counting-controls';
export function CountingSignature({ onChange,disabled }: { onChange: (png: string) => void; disabled: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null),point = useRef<{ x: number; y: number } | null>(null),[error,setError] = useState('');
  const [uploaded,setUploaded] = useState(false);
  function position(event: PointerEvent<HTMLCanvasElement>) { const bounds = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX-bounds.left)*600/bounds.width,y: (event.clientY-bounds.top)*240/bounds.height }; }
  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || !point.current) return; const next = position(event),ctx = canvas.current!.getContext('2d'); if (!ctx) return;
    ctx.strokeStyle = '#123b63'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(point.current.x,point.current.y); ctx.lineTo(next.x,next.y); ctx.stroke(); point.current = next;
  }
  function finish(event: PointerEvent<HTMLCanvasElement>) { if (!point.current) return; draw(event); point.current = null; onChange(event.currentTarget.toDataURL('image/png')); setUploaded(false); }
  return <div className="space-y-3"><p id="count-signature-label" className="font-semibold">Assinatura do responsável</p>
    <p id="count-signature-help" className="text-sm text-[#45647f]">Peça ao responsável para assinar abaixo. A assinatura só será salva ao concluir a contagem.</p>
    <canvas ref={canvas} width={600} height={240} aria-labelledby="count-signature-label" aria-describedby="count-signature-help" className="block h-40 w-full touch-none rounded-lg border border-[#aabed0] bg-white"
      onPointerDown={event => { if (disabled) return; event.currentTarget.setPointerCapture(event.pointerId); point.current = position(event); }} onPointerMove={draw} onPointerUp={finish} onPointerCancel={finish}/>
    <button type="button" className={countingButton} disabled={disabled} onClick={() => { canvas.current?.getContext('2d')?.clearRect(0,0,600,240); onChange(''); setUploaded(false); }}>Limpar assinatura</button>
    <details><summary className="cursor-pointer py-3 underline underline-offset-4">Anexar assinatura em PNG</summary><label className="grid gap-2 text-sm">Arquivo da assinatura (até 256 KB)<input className={countingInput} type="file" accept="image/png" disabled={disabled} onChange={async event => {
      const file = event.target.files?.[0]; if (!file) return;
      if (file.type !== 'image/png' || file.size > 262144) { setError('Escolha uma imagem PNG de até 256 KB.'); return; }
      try { const reader = new FileReader(); const data = await new Promise<string>((resolve,reject) => { reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }); onChange(data); setError(''); setUploaded(true); }
      catch { setError('Não foi possível ler a assinatura. Escolha o arquivo novamente.'); }
    }}/></label></details>{uploaded && <p className="text-sm">Arquivo anexado para conferência.</p>}{error && <p role="alert">{error}</p>}
  </div>;
}
