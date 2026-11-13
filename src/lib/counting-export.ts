import path from 'node:path';
import sharp,{type OverlayOptions} from 'sharp';
export type CountingExportBlock={text:string;heading?:boolean;image?:Buffer};
const width=900,height=1400,margin=48;
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
async function textImage(text:string,bold=false){return sharp({text:{text:escape(text),font:`Rubik ${bold?'Bold ':''}${bold?28:22}`,fontfile:path.join(process.cwd(),'public/fonts',bold?'rubik-700.ttf':'rubik-400.ttf'),width:width-2*margin,rgba:true,wrap:'word-char'}}).png().toBuffer({resolveWithObject:true});}
export async function renderCountingImages(title:string,subtitle:string,blocks:CountingExportBlock[]):Promise<Buffer[]>{
 if(title.length>1000||subtitle.length>1000||blocks.reduce((n,b)=>n+b.text.length,0)>250000)throw new Error('Relatório excede o limite de exportação.');
 const pages:Buffer[]=[];let layers:OverlayOptions[]=[],y=margin;
 async function header(){const h=await textImage(title,true),s=await textImage(subtitle);layers=[{input:h.data,left:margin,top:margin},{input:s.data,left:margin,top:margin+h.info.height+12}];y=margin+h.info.height+s.info.height+40;}
 async function flush(){if(pages.length>=100)throw new Error('Relatório excede 100 páginas.');const footer=await textImage(`Clube e Park Rincão · Página ${pages.length+1}`);layers.push({input:footer.data,left:margin,top:height-margin-footer.info.height});pages.push(await sharp({create:{width,height,channels:3,background:'#ffffff'}}).composite(layers).png().toBuffer());}
 await header();
 for(const block of blocks){
   const segments=block.text.split(/\r?\n/).flatMap(line=>{const chars=Array.from(line);return chars.length?Array.from({length:Math.ceil(chars.length/240)},(_,i)=>chars.slice(i*240,(i+1)*240).join('')):[' '];});
   for(const segment of segments){const rendered=await textImage(segment,block.heading);if(y+rendered.info.height+20>height-margin-70){await flush();await header();}layers.push({input:rendered.data,left:margin,top:y});y+=rendered.info.height+(block.heading?22:12);}
   if(block.image){const rendered=await sharp(block.image).resize({width:400,height:150,fit:'inside'}).png().toBuffer({resolveWithObject:true});if(y+rendered.info.height+20>height-margin-70){await flush();await header();}layers.push({input:rendered.data,left:margin,top:y});y+=rendered.info.height+24;}
 }
 await flush();return pages;
}
