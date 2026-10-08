export type BilheteriaActor = {
  name?: string | null;
  cpf?: string | null;
};

export type PurchaseVoucherRow = {
  idvoucher: number;
  idcompra?: number | null;
  idagenda?: number | null;
  numvoucher: string | null;
  tpvoucher: string | null;
  stusado: string | null;
  dtuso?: string | null;
  vlunicompra: string | null;
  desconto_id: number | null;
  descricao: string | null;
  agenda_data: string | null;
  dtvalidade: string | null;
  cpf?: string | null;
  tpcompra?: string | null;
  dtcompra?: string | null;
};

export type PainelBilheteriaVoucherPrintModel = {
  purchaseId: number;
  voucherId: number;
  voucherCode: string;
  voucherNumber: string | null;
  cpf: string | null;
  type: string | null;
  typeLabel: string;
  description: string | null;
  purchaseLocation: string;
  purchaseDate: string | null;
  price: string;
  tpcompra: string | null;
  visitDate: string | null;
  validUntil: string;
  qrCodeUrl: string | null;
};

export type PainelBilheteriaPurchasePrintModel = {
  purchaseId: number;
  vouchers: PainelBilheteriaVoucherPrintModel[];
};

export class PainelBilheteriaError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PainelBilheteriaError";
    this.code = code;
    this.status = status;
  }
}

