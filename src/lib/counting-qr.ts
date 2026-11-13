import { VoucherOperationError } from './ops-voucher-validation-contract';
export function parseCountingCode(value: unknown): {purchaseId:number;voucherId:number}|{number:string} {
  if(typeof value!=='string') throw new VoucherOperationError('invalid_qr','Código de ingresso inválido.',400);
  const code=value.trim().toUpperCase();
  const pair=/^(\d+)-(\d+)$/.exec(code);
  if(pair){const purchaseId=Number(pair[1]),voucherId=Number(pair[2]);
    if([purchaseId,voucherId].every(n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647))return {purchaseId,voucherId};
  }else if(/^[A-Z0-9][A-Z0-9_-]{0,99}$/.test(code))return {number:code};
  throw new VoucherOperationError('invalid_qr','Código não reconhecido. Use o QR ou o número do voucher.',400);
}
