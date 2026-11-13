export type VoucherValidationRow = {
  idvoucher: number;
  idagenda: number | null;
  numvoucher: string | null;
  stusado: string | null;
  stvoucher: string | null;
  dtinicio_validade?: string | null;
  dtvalidade?: string | null;
  parque_operacional?: string | null;
  validacao_periodo_id?: number | null;
  validado_em?: string | null;
  validado_por_nome?: string | null;
  validacao_local_nome?: string | null;
  periodo_id?: number | null;
  closed_at?: string | null;
  caixa_periodo_id?: number | null;
  payment_period_ids?: number[];
  tpvoucher?: string | null;
  servico_id?: number | null;
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
  details?: { validation: { periodId: number | null; actorName?: string | null; locationName: string | null; validatedAt: string | null; date: string | null; time: string | null } };

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "VoucherOperationError";
    this.code = code;
    this.status = status;
  }
}
