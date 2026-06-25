import { type PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import { syncTicketValidation } from "@/lib/ticket-service";

type VoucherValidationRow = {
  idvoucher: number;
  idagenda: number | null;
  numvoucher: string | null;
  stusado: string | null;
  dtuso: string | null;
  hruso: string | null;
  idcompra: number | null;
  tpcompra: string | null;
  stcompra: string | null;
  formapag: string | null;
  payment_status: number | null;
  dtagenda: string | null;
  tpagenda: string | null;
};

type SchoolTripVoucherRow = VoucherValidationRow & {
  idescola: number | null;
  idagenda: number | null;
};

type VoucherOperationMode =
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

type VoucherOperationInputActor = {
  name?: string | null;
  cpf?: string | null;
};

class VoucherOperationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "VoucherOperationError";
    this.code = code;
    this.status = status;
  }
}

function getSaoPauloDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    date: `${valueByType.get("year")}-${valueByType.get("month")}-${valueByType.get("day")}`,
    time: `${valueByType.get("hour")}:${valueByType.get("minute")}:${valueByType.get("second")}`,
  };
}

function formatDateBr(value: string | null) {
  if (!value) {
    return "Nao informada";
  }

  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "Nao informada";
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function normalizeVoucherNumber(value: string) {
  return value.trim().toUpperCase();
}

function normalizeVoucherIds(voucherIds: number[]) {
  return Array.from(
    new Set(
      voucherIds.filter(
        (voucherId) => Number.isInteger(voucherId) && voucherId > 0,
      ),
    ),
  );
}

function normalizeCpfDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D+/g, "");
}

function buildAuditActorName(actor?: VoucherOperationInputActor | null) {
  const name = String(actor?.name ?? "").trim();
  const cpf = normalizeCpfDigits(actor?.cpf ?? "");

  if (name && cpf) {
    return `${name} (${cpf})`;
  }

  return name || cpf || null;
}

function isPromotionalAgenda(type: string | null) {
  return String(type ?? "").trim().toLowerCase() === "promo";
}

function getAffectedVoucherRows(
  vouchers: VoucherValidationRow[],
  affectedVoucherIds: number[],
) {
  const affectedIds = new Set(affectedVoucherIds);

  return vouchers.filter((voucher) => affectedIds.has(voucher.idvoucher));
}

function collectAffectedAgendaIds(vouchers: VoucherValidationRow[]) {
  return Array.from(
    new Set(
      vouchers
        .map((voucher) => Number(voucher.idagenda ?? 0))
        .filter(
          (agendaId) => Number.isInteger(agendaId) && Number(agendaId) > 0,
        ),
    ),
  );
}

function resolveAuditPurchaseId(
  vouchers: VoucherValidationRow[],
  explicitPurchaseId?: number | null,
) {
  if (Number.isInteger(explicitPurchaseId) && Number(explicitPurchaseId) > 0) {
    return Number(explicitPurchaseId);
  }

  const purchaseIds = Array.from(
    new Set(
      vouchers
        .map((voucher) => Number(voucher.idcompra ?? 0))
        .filter((purchaseId) => Number.isInteger(purchaseId) && purchaseId > 0),
    ),
  );

  return purchaseIds.length === 1 ? purchaseIds[0] : null;
}

function buildVoucherAuditDescription(input: {
  action: VoucherOperationSuccess["action"];
  mode: VoucherOperationMode;
  affectedVoucherRows: VoucherValidationRow[];
  explicitPurchaseId?: number | null;
  schoolId?: number | null;
  agendaId?: number | null;
  requestedVoucherNumber?: string | null;
}) {
  const count = input.affectedVoucherRows.length;
  const voucherNumbers = input.affectedVoucherRows
    .map((voucher) => voucher.numvoucher ?? String(voucher.idvoucher))
    .join(", ");
  const actionLabel =
    input.action === "validate"
      ? "validado(s)"
      : input.action === "unvalidate"
        ? "desvalidado(s)"
        : "invalidado(s)";

  if (input.mode === "voucher_number") {
    return `Voucher ${input.requestedVoucherNumber ?? voucherNumbers} ${actionLabel} operacionalmente.`;
  }

  if (input.mode === "purchase") {
    const purchaseId = resolveAuditPurchaseId(
      input.affectedVoucherRows,
      input.explicitPurchaseId,
    );

    return `${count} voucher(s) ${actionLabel} operacionalmente na compra ${purchaseId ?? "-"}.`;
  }

  if (input.mode === "school_trip") {
    return `${count} voucher(s) do passeio escolar ${input.schoolId ?? "-"}:${input.agendaId ?? "-"} ${actionLabel} operacionalmente.`;
  }

  return `${count} voucher(s) ${actionLabel} operacionalmente: ${voucherNumbers}.`;
}

function buildVoucherAuditReason(
  action: VoucherOperationSuccess["action"],
  mode: VoucherOperationMode,
) {
  if (action === "validate") {
    if (mode === "school_trip") {
      return "Validacao operacional de vouchers de passeio escolar.";
    }

    return "Validacao operacional de vouchers pelo BFF.";
  }

  if (action === "unvalidate") {
    return "Desvalidacao operacional de vouchers pelo BFF.";
  }

  return "Invalidacao operacional de vouchers pelo BFF.";
}

async function registerVoucherOperationAuditLog(
  client: PoolClient,
  input: {
    action: VoucherOperationSuccess["action"];
    mode: VoucherOperationMode;
    actor?: VoucherOperationInputActor | null;
    vouchers: VoucherValidationRow[];
    affectedVoucherIds: number[];
    warnings?: string[];
    skippedVoucherNumbers?: string[];
    explicitPurchaseId?: number | null;
    requestedVoucherNumber?: string | null;
    schoolId?: number | null;
    agendaId?: number | null;
  },
) {
  const affectedVoucherRows = getAffectedVoucherRows(
    input.vouchers,
    input.affectedVoucherIds,
  );

  return registerOpsAuditLog(client, {
    origem: "voucher",
    acao:
      input.action === "validate"
        ? "validar"
        : input.action === "unvalidate"
          ? "desvalidar"
          : "invalidar",
    compraId: resolveAuditPurchaseId(
      affectedVoucherRows,
      input.explicitPurchaseId,
    ),
    descricao: buildVoucherAuditDescription({
      action: input.action,
      mode: input.mode,
      affectedVoucherRows,
      explicitPurchaseId: input.explicitPurchaseId,
      schoolId: input.schoolId,
      agendaId: input.agendaId,
      requestedVoucherNumber: input.requestedVoucherNumber,
    }),
    motivo: buildVoucherAuditReason(input.action, input.mode),
    usuarioNome: buildAuditActorName(input.actor),
    detalhes: {
      via: "apps/web",
      mode: input.mode,
      affectedVoucherIds: input.affectedVoucherIds,
      affectedVoucherNumbers: affectedVoucherRows.map(
        (voucher) => voucher.numvoucher ?? String(voucher.idvoucher),
      ),
      purchaseIds: Array.from(
        new Set(
          affectedVoucherRows
            .map((voucher) => Number(voucher.idcompra ?? 0))
            .filter(
              (purchaseId) =>
                Number.isInteger(purchaseId) && Number(purchaseId) > 0,
            ),
        ),
      ),
      affectedAgendaIds: collectAffectedAgendaIds(affectedVoucherRows),
      warnings: input.warnings ?? [],
      skippedVoucherNumbers: input.skippedVoucherNumbers ?? [],
      requestedVoucherNumber: input.requestedVoucherNumber ?? null,
      schoolId: input.schoolId ?? null,
      agendaId: input.agendaId ?? null,
      actor: {
        name: String(input.actor?.name ?? "").trim() || null,
        cpf: normalizeCpfDigits(input.actor?.cpf ?? "") || null,
      },
    },
  });
}

function isOnlinePurchasePaid(row: VoucherValidationRow) {
  return row.stcompra === "conc" && [3, 4].includes(Number(row.payment_status));
}

function isReservationPaid(row: VoucherValidationRow) {
  const paymentMethod = String(row.formapag ?? "").trim().toUpperCase();

  return row.stcompra === "conc" && paymentMethod !== "" && paymentMethod !== "N/A";
}

function buildReservationPaymentMessage(row: VoucherValidationRow) {
  return `A Reserva do Voucher ${row.numvoucher ?? ""} esta agendada para o dia ${formatDateBr(row.dtagenda)}. Dirija-se a bilheteria para efetuar o pagamento.`;
}

function buildAlreadyUsedMessage(row: VoucherValidationRow) {
  return `Voucher ${row.numvoucher ?? ""} ja utilizado em: ${formatDateBr(row.dtuso)} ${String(row.hruso ?? "").trim()}`.trim();
}

function evaluateAgendaUsage(
  row: VoucherValidationRow,
  confirm: boolean,
  todayDate: string,
) {
  const visitDate = String(row.dtagenda ?? "").slice(0, 10);

  if (!visitDate) {
    return {
      status: "ok" as const,
    };
  }

  if (isPromotionalAgenda(row.tpagenda)) {
    if (visitDate !== todayDate) {
      return {
        status: "invalid" as const,
        code: "voucher_invalid_visit_date",
        message: `Voucher valido apenas no dia da visita para data promocional: ${formatDateBr(row.dtagenda)}`,
      };
    }

    return {
      status: "ok" as const,
    };
  }

  if (visitDate === todayDate || confirm) {
    return {
      status: "ok" as const,
    };
  }

  return {
    status: "confirmation_required" as const,
    code: "voucher_confirmation_required",
    message: `${row.numvoucher ?? ""} - Voucher valido, porem a data agendada e: ${formatDateBr(row.dtagenda)}`,
  };
}

async function getVoucherByNumber(client: PoolClient, voucherNumber: string) {
  const result = await client.query<VoucherValidationRow>(
    `
      SELECT
        voucher.idvoucher,
        voucher.idagenda,
        voucher.numvoucher,
        voucher.stusado,
        to_char(voucher.dtuso, 'YYYY-MM-DD') AS dtuso,
        voucher.hruso::text AS hruso,
        voucher.idcompra,
        compra.tpcompra,
        compra.stcompra,
        compra.formapag,
        pagpagseguro.status AS payment_status,
        agenda.dtagenda::text AS dtagenda,
        agenda.tpagenda
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.numvoucher = $1
      LIMIT 1
      FOR UPDATE OF voucher, compra
    `,
    [voucherNumber],
  );

  return result.rows[0] ?? null;
}

async function getVouchersByPurchaseId(client: PoolClient, purchaseId: number) {
  const result = await client.query<VoucherValidationRow>(
    `
      SELECT
        voucher.idvoucher,
        voucher.idagenda,
        voucher.numvoucher,
        voucher.stusado,
        to_char(voucher.dtuso, 'YYYY-MM-DD') AS dtuso,
        voucher.hruso::text AS hruso,
        voucher.idcompra,
        compra.tpcompra,
        compra.stcompra,
        compra.formapag,
        pagpagseguro.status AS payment_status,
        agenda.dtagenda::text AS dtagenda,
        agenda.tpagenda
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idcompra = $1
      ORDER BY voucher.idvoucher ASC
      FOR UPDATE OF voucher, compra
    `,
    [purchaseId],
  );

  return result.rows;
}

async function getVouchersByIds(client: PoolClient, voucherIds: number[]) {
  const result = await client.query<VoucherValidationRow>(
    `
      SELECT
        voucher.idvoucher,
        voucher.idagenda,
        voucher.numvoucher,
        voucher.stusado,
        to_char(voucher.dtuso, 'YYYY-MM-DD') AS dtuso,
        voucher.hruso::text AS hruso,
        voucher.idcompra,
        compra.tpcompra,
        compra.stcompra,
        compra.formapag,
        pagpagseguro.status AS payment_status,
        agenda.dtagenda::text AS dtagenda,
        agenda.tpagenda
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idvoucher = ANY($1::int[])
      ORDER BY voucher.idvoucher ASC
      FOR UPDATE OF voucher, compra
    `,
    [voucherIds],
  );

  return result.rows;
}

async function markVoucherUsed(
  client: PoolClient,
  voucherId: number,
  date: string,
  time: string,
) {
  await client.query(
    `
      UPDATE voucher
      SET stusado = 's',
          dtuso = $2,
          hruso = $3
      WHERE idvoucher = $1
    `,
    [voucherId, date, time],
  );
}

async function markVoucherUnused(client: PoolClient, voucherId: number) {
  await client.query(
    `
      UPDATE voucher
      SET stusado = 'n',
          dtuso = NULL,
          hruso = NULL
      WHERE idvoucher = $1
    `,
    [voucherId],
  );
}

async function markVoucherInvalid(
  client: PoolClient,
  voucherId: number,
  date: string,
  time: string,
) {
  await client.query(
    `
      UPDATE voucher
      SET stusado = 'inv',
          dtuso = $2,
          hruso = $3
      WHERE idvoucher = $1
    `,
    [voucherId, date, time],
  );
}

async function appendTicketWarnings(
  warnings: string[],
  action: "validate" | "unvalidate" | "invalidate",
  pairs: Array<{ purchaseId: number; voucherId: number }>,
) {
  if (pairs.length === 0) {
    return warnings;
  }

  const result = await syncTicketValidation(pairs, action);

  if (result.status === "sent") {
    return warnings;
  }

  return [
    ...warnings,
    `Aviso: sincronizacao com o servico de tickets nao concluida (${result.skippedReason ?? "ticket_sync_failed"}).`,
  ];
}

async function getSchoolTripVouchers(
  client: PoolClient,
  schoolId: number,
  agendaId: number,
) {
  const result = await client.query<SchoolTripVoucherRow>(
    `
      SELECT
        voucher.idvoucher,
        voucher.idagenda,
        voucher.numvoucher,
        voucher.stusado,
        to_char(voucher.dtuso, 'YYYY-MM-DD') AS dtuso,
        voucher.hruso::text AS hruso,
        voucher.idcompra,
        compra.tpcompra,
        compra.stcompra,
        compra.formapag,
        pagpagseguro.status AS payment_status,
        agenda.dtagenda::text AS dtagenda,
        agenda.tpagenda,
        voucher.idescola,
        voucher.idagenda
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN pagpagseguro ON pagpagseguro.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idescola = $1
        AND voucher.idagenda = $2
        AND COALESCE(voucher.tpparticipante, '') <> 'educador'
      ORDER BY voucher.idvoucher ASC
      FOR UPDATE
    `,
    [schoolId, agendaId],
  );

  return result.rows;
}

export async function validateVoucherByNumber(
  voucherNumberInput: string,
  confirm = false,
  actor?: VoucherOperationInputActor | null,
): Promise<VoucherOperationSuccess> {
  const voucherNumber = normalizeVoucherNumber(voucherNumberInput);

  if (!voucherNumber) {
    throw new VoucherOperationError(
      "invalid_voucher_number",
      "Informe um numero de voucher valido.",
      400,
    );
  }

  const { date, time } = getSaoPauloDateParts();
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const voucher = await getVoucherByNumber(client, voucherNumber);

    if (!voucher) {
      throw new VoucherOperationError(
        "voucher_not_found",
        `Voucher ${voucherNumber} nao localizado.`,
        404,
      );
    }

    if (voucher.tpcompra !== "ponli") {
      throw new VoucherOperationError(
        "voucher_payment_required",
        buildReservationPaymentMessage(voucher),
        409,
      );
    }

    if (voucher.stusado !== "n") {
      throw new VoucherOperationError(
        "voucher_already_used",
        buildAlreadyUsedMessage(voucher),
        409,
      );
    }

    if (voucher.stcompra !== "conc") {
      throw new VoucherOperationError(
        "voucher_payment_pending",
        `Voucher ${voucher.numvoucher ?? ""} pendente de pagamento.`,
        409,
      );
    }

    if (!isOnlinePurchasePaid(voucher)) {
      throw new VoucherOperationError(
        "voucher_payment_status_invalid",
        `A transacao do voucher ${voucher.numvoucher ?? ""} nao esta confirmada para validacao.`,
        409,
      );
    }

    const usage = evaluateAgendaUsage(voucher, confirm, date);

    if (usage.status === "invalid" || usage.status === "confirmation_required") {
      throw new VoucherOperationError(usage.code, usage.message, 409);
    }

    await markVoucherUsed(client, voucher.idvoucher, date, time);
    const auditLogId = await registerVoucherOperationAuditLog(client, {
      action: "validate",
      mode: "voucher_number",
      actor,
      vouchers: [voucher],
      affectedVoucherIds: [voucher.idvoucher],
      explicitPurchaseId: Number(voucher.idcompra ?? 0) || null,
      requestedVoucherNumber: voucher.numvoucher ?? voucherNumber,
    });
    await client.query("COMMIT");

    console.info("ops-voucher-validate", {
      mode: "voucher_number",
      voucherId: voucher.idvoucher,
      voucherNumber: voucher.numvoucher ?? voucherNumber,
      purchaseId: voucher.idcompra,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
      auditLogId,
    });

    const warnings = await appendTicketWarnings([], "validate", [
      {
        purchaseId: Number(voucher.idcompra ?? 0),
        voucherId: voucher.idvoucher,
      },
    ]);

    return {
      action: "validate",
      mode: "voucher_number",
      processedCount: 1,
      affectedVoucherIds: [voucher.idvoucher],
      warnings,
      message: `${voucher.numvoucher ?? voucherNumber} - Voucher Validado com sucesso! Entrada permitida`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function validatePurchaseVouchers(
  purchaseId: number,
  confirm = false,
  actor?: VoucherOperationInputActor | null,
): Promise<VoucherOperationSuccess> {
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new VoucherOperationError(
      "invalid_purchase_id",
      "Informe um identificador de compra valido.",
      400,
    );
  }

  const { date, time } = getSaoPauloDateParts();
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const vouchers = await getVouchersByPurchaseId(client, purchaseId);

    if (vouchers.length === 0) {
      throw new VoucherOperationError(
        "purchase_not_found",
        "Compra nao encontrada para validacao operacional.",
        404,
      );
    }

    const affectedVoucherIds: number[] = [];
    const skippedVoucherNumbers: string[] = [];
    const warnings: string[] = [];

    for (const voucher of vouchers) {
      if (voucher.stusado === "s" || voucher.stusado === "inv") {
        continue;
      }

      if (voucher.stusado !== "n") {
        warnings.push(`Voucher ${voucher.numvoucher ?? voucher.idvoucher} nao esta disponivel para validacao.`);
        continue;
      }

      if (voucher.tpcompra === "ponli") {
        if (voucher.stcompra !== "conc") {
          throw new VoucherOperationError(
            "voucher_payment_pending",
            `Voucher ${voucher.numvoucher ?? ""} pendente de pagamento.`,
            409,
          );
        }

        if (!isOnlinePurchasePaid(voucher)) {
          throw new VoucherOperationError(
            "voucher_payment_status_invalid",
            `A transacao do voucher ${voucher.numvoucher ?? ""} nao esta confirmada para validacao.`,
            409,
          );
        }

        const usage = evaluateAgendaUsage(voucher, confirm, date);

        if (usage.status === "invalid") {
          throw new VoucherOperationError(usage.code, usage.message, 409);
        }

        if (usage.status === "confirmation_required") {
          skippedVoucherNumbers.push(voucher.numvoucher ?? String(voucher.idvoucher));
          continue;
        }
      } else if (voucher.tpcompra === "reser") {
        if (!isReservationPaid(voucher)) {
          throw new VoucherOperationError(
            "voucher_payment_required",
            buildReservationPaymentMessage(voucher),
            409,
          );
        }
      } else {
        throw new VoucherOperationError(
          "voucher_invalid_purchase_type",
          "Tipo de compra invalido para o voucher.",
          409,
        );
      }

      await markVoucherUsed(client, voucher.idvoucher, date, time);
      affectedVoucherIds.push(voucher.idvoucher);
    }

    if (affectedVoucherIds.length === 0 && skippedVoucherNumbers.length > 0) {
      throw new VoucherOperationError(
        "voucher_confirmation_required",
        `Os vouchers da compra exigem confirmacao para uso fora da data: ${skippedVoucherNumbers.join(", ")}`,
        409,
      );
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_validation_unavailable",
        "Nenhum voucher disponivel para validacao nesta compra.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      action: "validate",
      mode: "purchase",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
      skippedVoucherNumbers,
      explicitPurchaseId: purchaseId,
    });
    await client.query("COMMIT");

    console.info("ops-voucher-validate", {
      mode: "purchase",
      purchaseId,
      affectedVoucherIds,
      skippedVoucherNumbers,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
      auditLogId,
    });

    const warningsWithTickets = await appendTicketWarnings(
      warnings,
      "validate",
      vouchers
        .filter((voucher) => affectedVoucherIds.includes(voucher.idvoucher))
        .map((voucher) => ({
          purchaseId: Number(voucher.idcompra ?? purchaseId),
          voucherId: voucher.idvoucher,
        })),
    );

    if (skippedVoucherNumbers.length > 0) {
      warningsWithTickets.push(
        `Ignorados por data diferente: ${skippedVoucherNumbers.join(", ")}.`,
      );
    }

    return {
      action: "validate",
      mode: "purchase",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      skippedVoucherNumbers,
      message: "Vouchers validados com sucesso! Entrada permitida.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function validateSelectedVouchers(
  voucherIdsInput: number[],
  actor?: VoucherOperationInputActor | null,
): Promise<VoucherOperationSuccess> {
  const voucherIds = normalizeVoucherIds(voucherIdsInput);

  if (voucherIds.length === 0) {
    throw new VoucherOperationError(
      "invalid_voucher_selection",
      "Informe vouchers validos para validacao operacional.",
      400,
    );
  }

  const { date, time } = getSaoPauloDateParts();
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const vouchers = await getVouchersByIds(client, voucherIds);
    const vouchersById = new Map(vouchers.map((voucher) => [voucher.idvoucher, voucher]));
    const affectedVoucherIds: number[] = [];
    const warnings: string[] = [];

    for (const voucherId of voucherIds) {
      const voucher = vouchersById.get(voucherId);

      if (!voucher) {
        warnings.push(`Voucher ${voucherId} nao encontrado.`);
        continue;
      }

      if (voucher.stusado !== "n") {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucherId} ja utilizado ou indisponivel para validacao.`,
        );
        continue;
      }

      await markVoucherUsed(client, voucher.idvoucher, date, time);
      affectedVoucherIds.push(voucher.idvoucher);
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_validation_unavailable",
        warnings[0] ?? "Nenhum voucher pode ser validado.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      action: "validate",
      mode: "selection",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
    });
    await client.query("COMMIT");

    console.info("ops-voucher-validate", {
      mode: "selection",
      affectedVoucherIds,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
      auditLogId,
    });

    const warningsWithTickets = await appendTicketWarnings(
      warnings,
      "validate",
      vouchers
        .filter((voucher) => affectedVoucherIds.includes(voucher.idvoucher))
        .map((voucher) => ({
          purchaseId: Number(voucher.idcompra ?? 0),
          voucherId: voucher.idvoucher,
        })),
    );

    return {
      action: "validate",
      mode: "selection",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      message: `${affectedVoucherIds.length} voucher(s) validado(s) com sucesso.`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function validateSchoolTripVouchers(
  schoolId: number,
  agendaId: number,
  actor?: VoucherOperationInputActor | null,
): Promise<VoucherOperationSuccess> {
  if (
    !Number.isInteger(schoolId) ||
    schoolId <= 0 ||
    !Number.isInteger(agendaId) ||
    agendaId <= 0
  ) {
    throw new VoucherOperationError(
      "invalid_school_trip",
      "Informe schoolId e agendaId validos para o passeio.",
      400,
    );
  }

  const { date, time } = getSaoPauloDateParts();
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const vouchers = await getSchoolTripVouchers(client, schoolId, agendaId);

    if (vouchers.length === 0) {
      throw new VoucherOperationError(
        "school_trip_not_found",
        "Nenhum voucher de passeio encontrado para os identificadores informados.",
        404,
      );
    }

    const affectedVoucherIds: number[] = [];
    const warnings: string[] = [];

    for (const voucher of vouchers) {
      if (voucher.stusado === "s" || voucher.stusado === "inv") {
        continue;
      }

      if (voucher.stusado !== "n") {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucher.idvoucher} nao esta disponivel para validacao.`,
        );
        continue;
      }

      if (voucher.tpcompra === "ponli") {
        if (voucher.stcompra !== "conc") {
          throw new VoucherOperationError(
            "voucher_payment_pending",
            `Voucher ${voucher.numvoucher ?? ""} pendente de pagamento.`,
            409,
          );
        }

        if (!isOnlinePurchasePaid(voucher)) {
          throw new VoucherOperationError(
            "voucher_payment_status_invalid",
            `A transacao do voucher ${voucher.numvoucher ?? ""} nao esta confirmada para validacao.`,
            409,
          );
        }

        const usage = evaluateAgendaUsage(voucher, false, date);

        if (usage.status !== "ok") {
          throw new VoucherOperationError(usage.code, usage.message, 409);
        }
      } else if (voucher.tpcompra === "reser") {
        if (!isReservationPaid(voucher)) {
          throw new VoucherOperationError(
            "voucher_payment_required",
            buildReservationPaymentMessage(voucher),
            409,
          );
        }
      } else {
        throw new VoucherOperationError(
          "voucher_invalid_purchase_type",
          "Tipo de compra invalido para o voucher.",
          409,
        );
      }

      await markVoucherUsed(client, voucher.idvoucher, date, time);
      affectedVoucherIds.push(voucher.idvoucher);
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_validation_unavailable",
        "Nenhum voucher do passeio pode ser validado.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      action: "validate",
      mode: "school_trip",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
      schoolId,
      agendaId,
    });
    await client.query("COMMIT");

    console.info("ops-voucher-validate", {
      mode: "school_trip",
      schoolId,
      agendaId,
      affectedVoucherIds,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
      auditLogId,
    });

    const warningsWithTickets = await appendTicketWarnings(
      warnings,
      "validate",
      vouchers
        .filter((voucher) => affectedVoucherIds.includes(voucher.idvoucher))
        .map((voucher) => ({
          purchaseId: Number(voucher.idcompra ?? 0),
          voucherId: voucher.idvoucher,
        })),
    );

    return {
      action: "validate",
      mode: "school_trip",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      message: "Vouchers do passeio validados com sucesso! Entrada permitida.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function unvalidateSelectedVouchers(
  voucherIdsInput: number[],
  actor?: VoucherOperationInputActor | null,
): Promise<VoucherOperationSuccess> {
  const voucherIds = normalizeVoucherIds(voucherIdsInput);

  if (voucherIds.length === 0) {
    throw new VoucherOperationError(
      "invalid_voucher_selection",
      "Informe vouchers validos para desvalidacao operacional.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const vouchers = await getVouchersByIds(client, voucherIds);
    const vouchersById = new Map(vouchers.map((voucher) => [voucher.idvoucher, voucher]));
    const affectedVoucherIds: number[] = [];
    const warnings: string[] = [];

    for (const voucherId of voucherIds) {
      const voucher = vouchersById.get(voucherId);

      if (!voucher) {
        warnings.push(`Voucher ${voucherId} nao encontrado.`);
        continue;
      }

      if (voucher.stusado !== "s") {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucherId} nao esta validado.`,
        );
        continue;
      }

      await markVoucherUnused(client, voucher.idvoucher);
      affectedVoucherIds.push(voucher.idvoucher);

      console.info("ops-voucher-unvalidate", {
        voucherId: voucher.idvoucher,
        voucherNumber: voucher.numvoucher,
        purchaseId: voucher.idcompra,
        actorName: String(actor?.name ?? "").trim() || null,
        actorCpf: String(actor?.cpf ?? "").trim() || null,
      });
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_unvalidate_unavailable",
        warnings[0] ?? "Nenhum voucher pode ser desvalidado.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      action: "unvalidate",
      mode: "selection",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
    });
    await client.query("COMMIT");

    console.info("ops-voucher-unvalidate", {
      mode: "selection",
      affectedVoucherIds,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
      auditLogId,
    });

    const warningsWithTickets = await appendTicketWarnings(
      warnings,
      "unvalidate",
      vouchers
        .filter((voucher) => affectedVoucherIds.includes(voucher.idvoucher))
        .map((voucher) => ({
          purchaseId: Number(voucher.idcompra ?? 0),
          voucherId: voucher.idvoucher,
        })),
    );

    return {
      action: "unvalidate",
      mode: "selection",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      message: `${affectedVoucherIds.length} voucher(s) desvalidado(s) com sucesso.`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function unvalidatePurchaseVouchers(
  purchaseId: number,
  actor?: VoucherOperationInputActor | null,
): Promise<VoucherOperationSuccess> {
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new VoucherOperationError(
      "invalid_purchase_id",
      "Informe um identificador de compra valido.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const vouchers = await getVouchersByPurchaseId(client, purchaseId);

    if (vouchers.length === 0) {
      throw new VoucherOperationError(
        "purchase_not_found",
        "Compra nao encontrada para desvalidacao operacional.",
        404,
      );
    }

    const affectedVoucherIds: number[] = [];
    const warnings: string[] = [];

    for (const voucher of vouchers) {
      if (voucher.stusado !== "s") {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucher.idvoucher} nao esta validado.`,
        );
        continue;
      }

      await markVoucherUnused(client, voucher.idvoucher);
      affectedVoucherIds.push(voucher.idvoucher);

      console.info("ops-purchase-unvalidate", {
        purchaseId,
        voucherId: voucher.idvoucher,
        voucherNumber: voucher.numvoucher,
        actorName: String(actor?.name ?? "").trim() || null,
        actorCpf: String(actor?.cpf ?? "").trim() || null,
      });
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_unvalidate_unavailable",
        "Nenhum voucher validado foi encontrado nesta compra.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      action: "unvalidate",
      mode: "purchase",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
      explicitPurchaseId: purchaseId,
    });
    await client.query("COMMIT");

    console.info("ops-purchase-unvalidate", {
      purchaseId,
      affectedVoucherIds,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
      auditLogId,
    });

    const warningsWithTickets = await appendTicketWarnings(
      warnings,
      "unvalidate",
      vouchers
        .filter((voucher) => affectedVoucherIds.includes(voucher.idvoucher))
        .map((voucher) => ({
          purchaseId: Number(voucher.idcompra ?? purchaseId),
          voucherId: voucher.idvoucher,
        })),
    );

    return {
      action: "unvalidate",
      mode: "purchase",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      message: `Todos os vouchers validados da compra ${purchaseId} foram desvalidados.`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function invalidateSelectedVouchers(
  voucherIdsInput: number[],
  actor?: VoucherOperationInputActor | null,
): Promise<VoucherOperationSuccess> {
  const voucherIds = normalizeVoucherIds(voucherIdsInput);

  if (voucherIds.length === 0) {
    throw new VoucherOperationError(
      "invalid_voucher_selection",
      "Informe vouchers validos para invalidacao operacional.",
      400,
    );
  }

  const { date, time } = getSaoPauloDateParts();
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const vouchers = await getVouchersByIds(client, voucherIds);
    const vouchersById = new Map(vouchers.map((voucher) => [voucher.idvoucher, voucher]));
    const affectedVoucherIds: number[] = [];
    const warnings: string[] = [];

    for (const voucherId of voucherIds) {
      const voucher = vouchersById.get(voucherId);

      if (!voucher) {
        warnings.push(`Voucher ${voucherId} nao encontrado.`);
        continue;
      }

      if (voucher.stusado === "inv") {
        warnings.push(
          `Voucher ${voucher.numvoucher ?? voucherId} ja esta invalidado.`,
        );
        continue;
      }

      await markVoucherInvalid(client, voucher.idvoucher, date, time);
      affectedVoucherIds.push(voucher.idvoucher);

      console.info("ops-voucher-invalidate", {
        voucherId: voucher.idvoucher,
        voucherNumber: voucher.numvoucher,
        purchaseId: voucher.idcompra,
        actorName: String(actor?.name ?? "").trim() || null,
        actorCpf: String(actor?.cpf ?? "").trim() || null,
      });
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_invalidate_unavailable",
        warnings[0] ?? "Nenhum voucher pode ser invalidado.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      action: "invalidate",
      mode: "selection",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
    });
    await client.query("COMMIT");

    console.info("ops-voucher-invalidate", {
      mode: "selection",
      affectedVoucherIds,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
      auditLogId,
    });

    const warningsWithTickets = await appendTicketWarnings(
      warnings,
      "invalidate",
      vouchers
        .filter((voucher) => affectedVoucherIds.includes(voucher.idvoucher))
        .map((voucher) => ({
          purchaseId: Number(voucher.idcompra ?? 0),
          voucherId: voucher.idvoucher,
        })),
    );

    return {
      action: "invalidate",
      mode: "selection",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      message: `${affectedVoucherIds.length} voucher(s) invalidado(s) com sucesso.`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function invalidatePurchaseVouchers(
  purchaseId: number,
  actor?: VoucherOperationInputActor | null,
): Promise<VoucherOperationSuccess> {
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new VoucherOperationError(
      "invalid_purchase_id",
      "Informe um identificador de compra valido.",
      400,
    );
  }

  const { date, time } = getSaoPauloDateParts();
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const vouchers = await getVouchersByPurchaseId(client, purchaseId);

    if (vouchers.length === 0) {
      throw new VoucherOperationError(
        "purchase_not_found",
        "Compra nao encontrada para invalidacao operacional.",
        404,
      );
    }

    const affectedVoucherIds: number[] = [];
    const warnings: string[] = [];

    for (const voucher of vouchers) {
      if (voucher.stusado === "inv") {
        continue;
      }

      await markVoucherInvalid(client, voucher.idvoucher, date, time);
      affectedVoucherIds.push(voucher.idvoucher);

      console.info("ops-purchase-invalidate", {
        purchaseId,
        voucherId: voucher.idvoucher,
        voucherNumber: voucher.numvoucher,
        actorName: String(actor?.name ?? "").trim() || null,
        actorCpf: String(actor?.cpf ?? "").trim() || null,
      });
    }

    if (affectedVoucherIds.length === 0) {
      throw new VoucherOperationError(
        "voucher_invalidate_unavailable",
        "Todos os vouchers da compra ja estavam invalidados.",
        409,
      );
    }

    const auditLogId = await registerVoucherOperationAuditLog(client, {
      action: "invalidate",
      mode: "purchase",
      actor,
      vouchers,
      affectedVoucherIds,
      warnings,
      explicitPurchaseId: purchaseId,
    });
    await client.query("COMMIT");

    console.info("ops-purchase-invalidate", {
      purchaseId,
      affectedVoucherIds,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
      auditLogId,
    });

    const warningsWithTickets = await appendTicketWarnings(
      warnings,
      "invalidate",
      vouchers
        .filter((voucher) => affectedVoucherIds.includes(voucher.idvoucher))
        .map((voucher) => ({
          purchaseId: Number(voucher.idcompra ?? purchaseId),
          voucherId: voucher.idvoucher,
        })),
    );

    return {
      action: "invalidate",
      mode: "purchase",
      processedCount: affectedVoucherIds.length,
      affectedVoucherIds,
      warnings: warningsWithTickets,
      message: `Todos os vouchers elegiveis da compra ${purchaseId} foram invalidados.`,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function asVoucherOperationError(error: unknown) {
  if (error instanceof VoucherOperationError) {
    return error;
  }

  return new VoucherOperationError(
    "voucher_operation_unavailable",
    "Nao foi possivel concluir a operacao de voucher agora.",
    502,
  );
}
