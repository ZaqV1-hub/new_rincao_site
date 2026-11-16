'use client';
import { useEffect,useRef,useState,type PointerEvent } from 'react';
import { countingButton,countingInput } from './counting-controls';
export function hasCountingSignatureInk(pixels: Uint8ClampedArray) {
  const count = pixels.length/4;
  if (count < 2) return false;
  // Match the server's white flattening and per-channel contrast check.
  for (let channel = 0;channel < 3;channel++) {
    let min = 255,max = 0,sum = 0,squares = 0;
    for (let i = 0;i < pixels.length;i += 4) {
      const alpha = pixels[i+3]/255,value = Math.floor(pixels[i+channel]*alpha+255*(1-alpha));
      min = Math.min(min,value); max = Math.max(max,value); sum += value; squares += value*value;
    }
    if (min < 240 && max > 250 && (squares-sum*sum/count)/(count-1) > 1) return true;
  }
  return false;
}
export function CountingSignature({ onChange,disabled,value = '' }: { onChange: (png: string) => void; disabled: boolean; value?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null),point = useRef<{ x: number; y: number } | null>(null),[error,setError] = useState('');
  const moved = useRef(false);
  const [uploaded,setUploaded] = useState(false);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    context.clearRect(0,0,600,240);
    if (!value) return;
    let alive = true;
    const image = new Image();
    image.onload = () => { if (alive) context.drawImage(image,0,0,600,240); };
    image.src = value;
    return () => { alive = false; };
  },[value]);
  function position(event: PointerEvent<HTMLCanvasElement>) { const bounds = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX-bounds.left)*600/bounds.width,y: (event.clientY-bounds.top)*240/bounds.height }; }
  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || !point.current) return; const next = position(event),ctx = canvas.current!.getContext('2d'); if (!ctx) return;
    if (Math.hypot(next.x-point.current.x,next.y-point.current.y) < 1) return;
    moved.current = true;
    ctx.strokeStyle = '#123b63'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(point.current.x,point.current.y); ctx.lineTo(next.x,next.y); ctx.stroke(); point.current = next;
  }
  function finish(event: PointerEvent<HTMLCanvasElement>) { if (!point.current) return; draw(event); point.current = null; if (moved.current) { onChange(event.currentTarget.toDataURL('image/png')); setError(''); setUploaded(false); } else if (!value) setError('Desenhe a assinatura; um toque sem traço não é suficiente.'); }
  return <div className="space-y-3"><p id="count-signature-label" className="font-semibold">Assinatura do responsável</p>
    <p id="count-signature-help" className="text-sm text-[#45647f]">Peça ao responsável para assinar abaixo. A assinatura só será salva ao concluir a contagem.</p>
    <canvas ref={canvas} width={600} height={240} aria-labelledby="count-signature-label" aria-describedby="count-signature-help" className="block h-44 w-full touch-none rounded-2xl border-2 border-dashed border-[#aabed0] bg-white"
      onPointerDown={event => { if (disabled) return; event.currentTarget.setPointerCapture(event.pointerId); point.current = position(event); moved.current = false; }} onPointerMove={draw} onPointerUp={finish} onPointerCancel={finish}/>
    <button type="button" className={countingButton} disabled={disabled} onClick={() => { canvas.current?.getContext('2d')?.clearRect(0,0,600,240); onChange(''); setUploaded(false); setError(''); }}>Limpar assinatura</button>
    <details><summary className="cursor-pointer py-3 underline underline-offset-4">Anexar assinatura em PNG</summary><label className="grid gap-2 text-sm">Arquivo da assinatura (até 256 KB)<input className={countingInput} type="file" accept="image/png" disabled={disabled} onChange={async event => {
      const file = event.target.files?.[0]; if (!file) return;
      if (file.type !== 'image/png' || file.size > 262144) { setError('Escolha uma imagem PNG de até 256 KB.'); return; }
      try { const reader = new FileReader(); const data = await new Promise<string>((resolve,reject) => { reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }); const image = new Image(); image.src = data; await image.decode();
        if (image.width < 3 || image.height < 3 || image.width*image.height > 1000000) throw new Error();
        const inspection = document.createElement('canvas'); inspection.width = image.width; inspection.height = image.height;
        const context = inspection.getContext('2d'); if (!context) throw new Error(); context.drawImage(image,0,0);
        if (!hasCountingSignatureInk(context.getImageData(0,0,image.width,image.height).data)) { setError('A imagem está vazia ou sem um traço de assinatura legível. Escolha outra assinatura.'); return; }
        onChange(data); setError(''); setUploaded(true); }
      catch { setError('Não foi possível ler a assinatura. Escolha o arquivo novamente.'); }
    }}/></label></details>{uploaded && <p className="text-sm">Arquivo anexado para conferência.</p>}{error && <p role="alert">{error}</p>}
  </div>;
}
