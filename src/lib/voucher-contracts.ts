export type PurchaseType = "ponli" | "reser";
export type PurchaseStatus = "conc" | "canc" | "pend" | string;
export type VoucherUseStatus = "s" | "n" | string;

export type UserVoucher = {
  id: number;
  type: string | null;
  typeLabel: string;
  number: string | null;
  visitDate: string | null;
  useDate: string | null;
  unitValue: string | null;
  used: boolean;
  useStatus: VoucherUseStatus | null;
  agendaType: string | null;
  schoolName: string | null;
  participantName: string | null;
  sent: boolean;
  validUntil: string | null;
  canSelectForVoucher: boolean;
  canReschedule: boolean;
  expiredForGeneration: boolean;
};

export type UserVoucherPurchase = {
  id: number;
  legacyEncodedId: string;
  type: PurchaseType;
  typeLabel: string;
  purchaseDate: string | null;
  totalValue: string | null;
  status: PurchaseStatus | null;
  statusLabel: string;
  payment: {
    provider: "pagseguro" | "bilheteria" | null;
    status: number | null;
    statusLabel: string;
    methodType: number | null;
  };
  unusedVoucherCount: number;
  voucherCount: number;
  canGenerateVoucher: boolean;
  canCancelReservation: boolean;
  vouchers: UserVoucher[];
};

export type UserVoucherCancelResponse = {
  ok: true;
  data: {
    purchaseId: number;
    status: "canc";
    statusLabel: string;
  };
};

export type UserVoucherRescheduleOption = {
  id: number;
  date: string;
  day: number;
  month: number;
  year: number;
};

export type UserVoucherRescheduleOptionsResponse = {
  ok: true;
  data: {
    voucherId: number;
    currentVisitDate: string | null;
    options: UserVoucherRescheduleOption[];
  };
};

export type UserVoucherRescheduleResponse = {
  ok: true;
  data: {
    voucherId: number;
    agendaId: number;
    visitDate: string;
    day: number;
    month: number;
    year: number;
  };
};

export type UserVouchersResponse = {
  ok: true;
  data: {
    limit: number;
    offset: number;
    totalPurchases: number;
    purchases: UserVoucherPurchase[];
    groups: {
      online: UserVoucherPurchase[];
      reservations: UserVoucherPurchase[];
    };
  };
};

export type OpsVoucherAction = "validate" | "unvalidate" | "invalidate";
export type OpsVoucherMode =
  | "voucher_number"
  | "selection"
  | "purchase"
  | "school_trip";

export type OpsVoucherOperationResponse = {
  ok: true;
  data: {
    action: OpsVoucherAction;
    mode: OpsVoucherMode;
    processedCount: number;
    affectedVoucherIds: number[];
    warnings: string[];
    message: string;
    skippedVoucherNumbers?: string[];
  };
};
