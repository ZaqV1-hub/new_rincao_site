import {expect,it} from 'vitest';
import sharp from 'sharp';
import {renderCountingImages} from './counting-export';
it('exports readable paginated images without dropping long observations',async()=>{
 const images=await renderCountingImages('Contagem','13/11/2026',[{text:'Observações',heading:true},{text:'Restrição alimentar & observação <teste>. '.repeat(300)}]);
 expect(images.length).toBeGreaterThan(1);
 for(const image of images)expect(await sharp(image).metadata()).toMatchObject({format:'png',width:900,height:1400});
});
it('renders report paragraph separators without passing blank text to the renderer',async()=>{
 const images=await renderCountingImages('Contagem geral','16/11/2026',[{text:'Grupo Sintético\n\nPessoas: 17\n   \nDay use: 1\n'}]);
 expect(images).toHaveLength(1);
 expect(await sharp(images[0]).metadata()).toMatchObject({format:'png',width:900,height:1400});
});
