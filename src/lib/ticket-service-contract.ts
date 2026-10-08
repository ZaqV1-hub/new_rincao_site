
export type TicketServiceConfig = {
  baseUrl: string;
  username: string;
  password: string;
  testing: boolean;
  timeoutMs: number;
};

export type VoucherTicketRow = {
  idvoucher: number;
  numvoucher: string | null;
  tpvoucher: string | null;
  descricao: string | null;
  vlunicompra: string | null;
  stusado: string | null;
  voucherenviado: string | null;
  identificacao: string | null;
  idagenda: number | null;
  dtagenda: string | null;
};

export type VoucherCpfSource = {
  identificacao: string | null;
};

export type VoucherCodeSource = {
  numvoucher: string | null;
  tpvoucher: string | null;
};

export type TicketSendResult = {
  status: "sent" | "skipped";
  purchaseId: number;
  sentVoucherIds: number[];
  skippedReason?: string;
};

export type TicketWhatsappSendResult = {
  status: "sent" | "skipped";
  purchaseId: number;
  sentVoucherIds: number[];
  skippedReason?: string;
  deliveryStatus?: "queued";
  upstreamStatus?: number;
};

export type TicketValidationAction = "validate" | "unvalidate" | "invalidate";

export type TicketValidationPair = {
  purchaseId: number;
  voucherId: number;
};

export type TicketValidationVoucherRow = {
  idcompra: number;
  idvoucher: number;
  numvoucher: string | null;
  tpvoucher: string | null;
  vlunicompra: string | null;
  identificacao: string | null;
  dtagenda: string | null;
  cpf: string | null;
  tpcompra: string | null;
  dtcompra: string | null;
  celular: string | null;
};

export type TicketValidationSyncResult = {
  status: "sent" | "skipped";
  action: TicketValidationAction;
  pairs: string[];
  skippedReason?: string;
};

export type PendingTicketDeliveryRecoveryItem = {
  purchaseId: number;
  pendingVouchers: number;
  result: "sent" | "skipped" | "error";
  sentVoucherIds: number[];
  note: string;
};

export type PendingTicketDeliveryRecoveryResult = {
  action: "ticket_delivery_recovery";
  candidates: number;
  processed: number;
  recovered: number;
  skipped: number;
  failed: number;
  items: PendingTicketDeliveryRecoveryItem[];
  message: string;
};
