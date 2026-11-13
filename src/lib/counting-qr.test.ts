import { describe,it,expect } from 'vitest';
import QRCode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { parseCountingCode } from './counting-qr';
describe('counting QR trust boundary',()=>{
  it('recognizes emitted purchase-voucher pairs and manual voucher numbers',()=>{
    expect(parseCountingCode('123-456')).toEqual({purchaseId:123,voucherId:456});
    expect(parseCountingCode(' ticket-1 ')).toEqual({number:'TICKET-1'});
  });
  it('decodes the emitted QR image into the canonical purchase-voucher pair',async()=>{
    const png=await QRCode.toBuffer('123-456',{width:320,margin:4});
    const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height);
    expect(parseCountingCode(decoded?.data)).toEqual({purchaseId:123,voucherId:456});
  });
  it.each(['https://example.com/1-2','javascript:alert(1)','0-3','9999999999999999-1','', 'a b'])('rejects arbitrary content %s',value=>expect(()=>parseCountingCode(value)).toThrow());
});
