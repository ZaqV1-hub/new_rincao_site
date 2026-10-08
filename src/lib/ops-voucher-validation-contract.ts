export type VoucherValidationRow = {
  idvoucher: number;
  idagenda: number | null;
  numvoucher: string | null;
  stusado: string | null;
  stvoucher: string | null;
  dtuso: string | null;
  hruso: string | null;
  idcompra: number | null;
  dtcompra: string | null;
  tpcompra: string | null;
  stcompra: string | null;
  formapag: string | null;
  payment_status: number | null;
  dtagenda: string | null;
  tpagenda: string | null;
};

export type SchoolTripVoucherRow = VoucherValidationRow & {
  idescola: number | null;
  idagenda: number | null;
};

export type VoucherOperationMode =
  | "voucher_number"
  | "selection"
  | "purchase"
  | "school_trip";

export type VoucherOperationSuccess = {
  action: "validate" | "unvalidate" | "invalidate";
  mode: VoucherOperationMode;
  processedCount: number;
  affectedVoucherIds: number[];
  warnings: string[];
  message: string;
  skippedVoucherNumbers?: string[];
};

export type VoucherOperationInputActor = {
  name?: string | null;
  cpf?: string | null;
};

export type VoucherAgendaUsageResult =
  | {
      status: "ok";
    }
  | {
      status: "invalid" | "confirmation_required";
      code: string;
      message: string;
    };

export class VoucherOperationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "VoucherOperationError";
    this.code = code;
    this.status = status;
  }
}

