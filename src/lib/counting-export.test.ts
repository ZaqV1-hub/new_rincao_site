import {expect,it} from 'vitest';
import sharp from 'sharp';
import {renderCountingImages} from './counting-export';
it('exports readable paginated images without dropping long observations',async()=>{
 const images=await renderCountingImages('Contagem','13/11/2026',[{text:'Observações',heading:true},{text:'Restrição alimentar & observação <teste>. '.repeat(300)}]);
 expect(images.length).toBeGreaterThan(1);
 for(const image of images)expect(await sharp(image).metadata()).toMatchObject({format:'png',width:900,height:1400});
});
