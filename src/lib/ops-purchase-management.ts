import type { PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import { syncTicketValidation } from "@/lib/ticket-service";

type PurchaseRow = {
  idcompra: number;
  tpcompra: string | null;
  stcompra: string | null;
  vltotcompra: string | null;
  dtcompra: string | null;
  cpf: string | null;
  formapag: string | null;
};

type PurchaseVoucherRow = {
  idvoucher: number;
  numvoucher: string | null;
  idcompra: number | null;
  stusado: string | null;
  vlunicompra: string | null;
  tpvoucher: string | null;
  descricao: string | null;
  desconto_id: number | null;
};

type PurchasePaymentRow = {
  forma_pagamento: string | null;
  valor: string | null;
};

type DiscountRow = {
  id: number;
  nome: string | null;
  tipo_aplicacao: string | null;
  valor: string | null;
};

type PurchaseActor = {
  name?: string | null;
  cpf?: string | null;
};

type VoucherStatus = "n" | "s" | "inv";

type VoucherPatchInput = {
  id: number;
  status?: string | null;
  value?: string | number | null;
  exclude?: boolean;
  discountId?: number | null;
  descontoId?: number | null;
  discount_id?: number | null;
};

type NormalizedVoucherPatch = {
  id: number;
  status?: VoucherStatus | null;
  value?: string | number | null;
  exclude?: boolean;
  discountId?: number | null;
};

type NormalizedPayment = {
  method: string;
  value: number;
};

type PurchaseUpdateVoucherChange = {
  voucherId: number;
  voucherNumber: string | null;
  voucherType: string | null;
  oldStatus: VoucherStatus;
  newStatus: VoucherStatus;
  oldValue: string;
  newValue: string;
  oldDiscountId: number | null;
  newDiscountId: number | null;
  oldDescription: string;
  newDescription: string;
};

type PurchasePaymentsAudit = Array<{
  method: string;
  value: string;
}>;

export type PurchaseOperationSuccess = {
  action: "cancel";
  purchaseId: number;
  status: "canc";
  affectedVoucherIds: number[];
  warnings: string[];
  message: string;
  auditLogId: number | null;
};

export type PurchaseUpdateInput = {
  purchaseId: number;
  reason: string;
  status?: string | null;
  purchaseDate: string;
  cpf?: string | null;
  vouchers?: VoucherPatchInput[];
  payments?: Array<{
    method: string;
    value: string | number;
  }>;
  actor?: PurchaseActor | null;
};

export type PurchaseUpdateSuccess = {
  action: "update";
  purchaseId: number;
  status: string;
  totalValue: string;
  paymentMethods: string[];
  affectedVoucherIds: number[];
  warnings: string[];
  message: string;
  auditLogId: number | null;
  unchanged?: boolean;
};

class PurchaseOperationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PurchaseOperationError";
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

async function getPurchaseById(client: PoolClient, purchaseId: number) {
  const result = await client.query<PurchaseRow>(
    `
      SELECT
        compra.idcompra,
        compra.tpcompra,
        compra.stcompra,
        compra.vltotcompra::text AS vltotcompra,
        compra.dtcompra::text AS dtcompra,
        compra.cpf,
        compra.formapag
      FROM compra
      WHERE compra.idcompra = $1
      LIMIT 1
      FOR UPDATE
    `,
    [purchaseId],
  );

  return result.rows[0] ?? null;
}

async function getPurchaseVouchers(client: PoolClient, purchaseId: number) {
  const result = await client.query<PurchaseVoucherRow>(
    `
      SELECT
        voucher.idvoucher,
        voucher.numvoucher,
        voucher.idcompra,
        voucher.stusado,
        voucher.vlunicompra::text AS vlunicompra,
        voucher.tpvoucher,
        voucher.descricao,
        voucher.desconto_id
      FROM voucher
      WHERE voucher.idcompra = $1
      ORDER BY voucher.idvoucher ASC
      FOR UPDATE
    `,
    [purchaseId],
  );

  return result.rows;
}

async function getPurchasePayments(client: PoolClient, purchaseId: number) {
  const result = await client.query<PurchasePaymentRow>(
    `
      SELECT
        forma_pagamento,
        valor::text AS valor
      FROM compra_pagamentos
      WHERE idcompra = $1
      ORDER BY id ASC
    `,
    [purchaseId],
  );

  return result.rows;
}

async function getDiscountById(client: PoolClient, discountId: number) {
  const result = await client.query<DiscountRow>(
    `
      SELECT
        descontos.id,
        descontos.nome,
        descontos.tipo_aplicacao,
        descontos.valor::text AS valor
      FROM descontos
      WHERE descontos.id = $1
      LIMIT 1
    `,
    [discountId],
  );

  return result.rows[0] ?? null;
}

async function cancelPurchase(client: PoolClient, purchaseId: number) {
  await client.query(
    `
      UPDATE compra
      SET stcompra = 'canc'
      WHERE idcompra = $1
    `,
    [purchaseId],
  );
}

async function updatePurchaseSummary(
  client: PoolClient,
  purchaseId: number,
  {
    status,
    purchaseDate,
    cpf,
    totalValue,
    firstPaymentMethod,
  }: {
    status: string;
    purchaseDate: string;
    cpf: string | null;
    totalValue: number;
    firstPaymentMethod: string | null;
  },
) {
  await client.query(
    `
      UPDATE compra
      SET dtcompra = $2,
          cpf = $3,
          vltotcompra = $4,
          stcompra = $5,
          formapag = $6
      WHERE idcompra = $1
    `,
    [
      purchaseId,
      purchaseDate,
      cpf,
      totalValue.toFixed(2),
      status,
      firstPaymentMethod,
    ],
  );
}

async function replacePurchasePayments(
  client: PoolClient,
  purchaseId: number,
  payments: NormalizedPayment[],
) {
  await client.query("DELETE FROM compra_pagamentos WHERE idcompra = $1", [
    purchaseId,
  ]);

  for (const payment of payments) {
    await client.query(
      `
        INSERT INTO compra_pagamentos (
          idcompra,
          forma_pagamento,
          valor,
          created_at
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `,
      [purchaseId, payment.method, payment.value.toFixed(2)],
    );
  }
}

async function invalidatePurchaseVoucher(
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

async function updateVoucherFields(
  client: PoolClient,
  voucherId: number,
  fields: {
    status?: VoucherStatus;
    date?: string | null;
    time?: string | null;
    value?: number;
    description?: string;
    discountId?: number | null;
  },
) {
  const assignments: string[] = [];
  const values: Array<string | number | null> = [voucherId];
  let index = 2;

  if (typeof fields.value === "number") {
    assignments.push(`vlunicompra = $${index}`);
    values.push(fields.value.toFixed(2));
    index += 1;
  }

  if (fields.discountId !== undefined) {
    assignments.push(`desconto_id = $${index}`);
    values.push(fields.discountId);
    index += 1;
  }

  if (fields.description !== undefined) {
    assignments.push(`descricao = $${index}`);
    values.push(fields.description);
    index += 1;
  }

  if (fields.status) {
    assignments.push(`stusado = $${index}`);
    values.push(fields.status);
    index += 1;

    assignments.push(`dtuso = $${index}`);
    values.push(fields.date ?? null);
    index += 1;

    assignments.push(`hruso = $${index}`);
    values.push(fields.time ?? null);
    index += 1;
  }

  if (assignments.length === 0) {
    return;
  }

  await client.query(
    `
      UPDATE voucher
      SET ${assignments.join(", ")}
      WHERE idvoucher = $1
    `,
    values,
  );
}

function normalizeCpfDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D+/g, "");
}

function parseDateInput(value: string) {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseMoneyInput(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value ?? "").trim().replace(/^R\$\s*/i, "");
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.includes(",")
        ? raw.replace(",", ".")
        : raw;

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeVoucherStatus(value: string | null | undefined) {
  return ["n", "s", "inv"].includes(String(value ?? "")) ?
      (String(value) as VoucherStatus) :
      null;
}

function normalizeVoucherPatch(voucher: VoucherPatchInput): NormalizedVoucherPatch {
  const discountCandidate =
    voucher.discountId ?? voucher.descontoId ?? voucher.discount_id ?? null;

  return {
    id: Number(voucher.id),
    status: normalizeVoucherStatus(voucher.status),
    value: voucher.value,
    exclude: voucher.exclude,
    discountId:
      discountCandidate == null ? null : Number(discountCandidate),
  };
}

function isVoucherDiscountEditable(voucherType: string | null) {
  return ["norma", "infan"].includes(String(voucherType ?? ""));
}

function getVoucherBaseTypeLabel(voucherType: string | null) {
  switch (String(voucherType ?? "")) {
    case "norma":
      return "Passaporte";
    case "infan":
      return "Passaporte Infantil";
    case "isent":
      return "Isento";
    case "corte":
      return "Cortesia";
    default:
      return String(voucherType ?? "Voucher") || "Voucher";
  }
}

function buildVoucherDescription(
  voucherType: string | null,
  discount: DiscountRow | null,
  currentDescription: string | null,
) {
  const baseLabel = getVoucherBaseTypeLabel(voucherType);

  if (!isVoucherDiscountEditable(voucherType)) {
    const trimmed = String(currentDescription ?? "").trim();
    return trimmed || baseLabel;
  }

  if (!discount || discount.id <= 0 || !String(discount.nome ?? "").trim()) {
    return `${baseLabel} - Normal`;
  }

  return `${baseLabel} - ${String(discount.nome ?? "").trim()}`;
}

function resolveVoucherBaseValue(
  voucher: PurchaseVoucherRow,
  currentDiscount: DiscountRow | null,
) {
  const currentValue = Number(voucher.vlunicompra ?? 0);

  if (!isVoucherDiscountEditable(voucher.tpvoucher) || !currentDiscount) {
    return roundMoney(currentValue);
  }

  const discountValue = Number(currentDiscount.valor ?? 0);

  if (currentDiscount.tipo_aplicacao === "percentual") {
    const factor = 1 - discountValue / 100;
    return factor > 0.0001 ? roundMoney(currentValue / factor) : roundMoney(currentValue);
  }

  if (currentDiscount.tipo_aplicacao === "valor_fixo") {
    return roundMoney(currentValue + discountValue);
  }

  return roundMoney(currentValue);
}

function resolveVoucherDiscountedValue(
  baseValue: number,
  discount: DiscountRow | null,
) {
  if (!discount) {
    return roundMoney(baseValue);
  }

  const discountValue = Number(discount.valor ?? 0);

  if (discount.tipo_aplicacao === "percentual") {
    return roundMoney(Math.max(0, baseValue - baseValue * discountValue / 100));
  }

  if (discount.tipo_aplicacao === "valor_fixo") {
    return roundMoney(Math.max(0, baseValue - discountValue));
  }

  return roundMoney(baseValue);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return `R$ ${parsed.toFixed(2).replace(".", ",")}`;
}

function formatStatusLabel(status: string | null | undefined) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "conc":
      return "Concluida";
    case "pend":
      return "Pendente";
    case "canc":
      return "Cancelada";
    default:
      return String(status ?? "-") || "-";
  }
}

function formatVoucherStatusLabel(status: VoucherStatus) {
  switch (status) {
    case "n":
      return "Nao usado";
    case "s":
      return "Validado";
    case "inv":
      return "Invalidado";
  }
}

function formatNullable(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || "-";
}

function normalizeAuditPayments(payments: NormalizedPayment[]): PurchasePaymentsAudit {
  return payments.map((payment) => ({
    method: payment.method,
    value: payment.value.toFixed(2),
  }));
}

function paymentsForLog(payments: PurchasePaymentsAudit) {
  return payments
    .map((payment) => `${payment.method}: ${formatMoney(payment.value)}`)
    .join(", ");
}

function buildVoucherChangeMessages(changes: PurchaseUpdateVoucherChange[]) {
  return changes.flatMap((change) => {
    const messages: string[] = [];

    if (change.oldStatus !== change.newStatus) {
      messages.push(
        `Voucher ${change.voucherId} status alterado de ${formatVoucherStatusLabel(change.oldStatus)} para ${formatVoucherStatusLabel(change.newStatus)}`,
      );
    }

    if (change.oldValue !== change.newValue) {
      messages.push(
        `Voucher ${change.voucherId} valor alterado de ${formatMoney(change.oldValue)} para ${formatMoney(change.newValue)}`,
      );
    }

    if ((change.oldDiscountId ?? 0) !== (change.newDiscountId ?? 0)) {
      messages.push(
        `Voucher ${change.voucherId} desconto alterado de ${formatNullable(change.oldDiscountId?.toString())} para ${formatNullable(change.newDiscountId?.toString())}`,
      );
    }

    if (change.oldDescription !== change.newDescription) {
      messages.push(
        `Voucher ${change.voucherId} descricao alterada de ${formatNullable(change.oldDescription)} para ${formatNullable(change.newDescription)}`,
      );
    }

    return messages;
  });
}

function buildAuditDescription(messages: string[]) {
  return messages.join("; ").slice(0, 4000);
}

function buildAuditActorName(actor?: PurchaseActor | null) {
  const name = String(actor?.name ?? "").trim();
  const cpf = normalizeCpfDigits(actor?.cpf ?? "");

  if (name && cpf) {
    return `${name} (${cpf})`;
  }

  return name || cpf || null;
}

function buildExistingPayments(
  purchase: PurchaseRow,
  existingPayments: PurchasePaymentRow[],
  totalValue: number,
) {
  const parsed = existingPayments
    .map((payment) => ({
      method: String(payment.forma_pagamento ?? "").trim(),
      value: parseMoneyInput(payment.valor),
    }))
    .filter(
      (payment): payment is NormalizedPayment =>
        payment.method !== "" && payment.value !== null,
    );

  if (parsed.length > 0) {
    return parsed;
  }

  const fallbackMethod = String(purchase.formapag ?? "").trim();

  if (fallbackMethod && fallbackMethod.toUpperCase() !== "N/A" && totalValue > 0.0001) {
    return [
      {
        method: fallbackMethod,
        value: roundMoney(totalValue),
      },
    ];
  }

  return [];
}

export async function cancelOperationalPurchase(
  purchaseId: number,
  reasonInput: string,
  actor?: PurchaseActor | null,
): Promise<PurchaseOperationSuccess> {
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    throw new PurchaseOperationError(
      "invalid_purchase_id",
      "Informe um identificador de compra valido.",
      400,
    );
  }

  const reason = reasonInput.trim();

  if (!reason) {
    throw new PurchaseOperationError(
      "invalid_cancel_reason",
      "Informe o motivo do cancelamento operacional.",
      400,
    );
  }

  const { date, time } = getSaoPauloDateParts();
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const purchase = await getPurchaseById(client, purchaseId);

    if (!purchase || !["bilhe", "reser"].includes(String(purchase.tpcompra ?? ""))) {
      throw new PurchaseOperationError(
        "purchase_not_found",
        "Compra operacional nao encontrada para cancelamento.",
        404,
      );
    }

    if (purchase.stcompra === "canc") {
      throw new PurchaseOperationError(
        "purchase_already_cancelled",
        "Esta compra ja esta cancelada.",
        409,
      );
    }

    const vouchers = await getPurchaseVouchers(client, purchaseId);
    const affectedVoucherIds: number[] = [];

    await cancelPurchase(client, purchaseId);

    for (const voucher of vouchers) {
      if (voucher.stusado === "inv") {
        continue;
      }

      await invalidatePurchaseVoucher(client, voucher.idvoucher, date, time);
      affectedVoucherIds.push(voucher.idvoucher);
    }

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "compra",
      acao: "excluir",
      compraId: purchaseId,
      descricao: `Compra cancelada no valor de ${formatMoney(purchase.vltotcompra)}`,
      motivo: reason,
      usuarioNome: buildAuditActorName(actor),
      detalhes: {
        via: "apps/web",
        status: "canc",
        affectedVoucherIds,
        actor: {
          name: String(actor?.name ?? "").trim() || null,
          cpf: normalizeCpfDigits(actor?.cpf ?? "") || null,
        },
      },
    });

    await client.query("COMMIT");

    console.info("ops-purchase-cancel", {
      purchaseId,
      purchaseType: purchase.tpcompra,
      totalValue: purchase.vltotcompra,
      reason,
      actorName: String(actor?.name ?? "").trim() || null,
      actorCpf: String(actor?.cpf ?? "").trim() || null,
      affectedVoucherIds,
      auditLogId,
    });

    const warnings: string[] = [];

    if (affectedVoucherIds.length > 0) {
      const sync = await syncTicketValidation(
        affectedVoucherIds.map((voucherId) => ({
          purchaseId,
          voucherId,
        })),
        "invalidate",
      );

      if (sync.status !== "sent") {
        warnings.push(
          `Aviso: sincronizacao com o servico de tickets nao concluida (${sync.skippedReason ?? "ticket_sync_failed"}).`,
        );
      }
    }

    return {
      action: "cancel",
      purchaseId,
      status: "canc",
      affectedVoucherIds,
      warnings,
      message: "Compra cancelada com sucesso.",
      auditLogId,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function asPurchaseOperationError(error: unknown) {
  if (error instanceof PurchaseOperationError) {
    return error;
  }

  return new PurchaseOperationError(
    "purchase_operation_unavailable",
    "Nao foi possivel concluir a operacao da compra agora.",
    502,
  );
}

export async function updateOperationalPurchase(
  input: PurchaseUpdateInput,
): Promise<PurchaseUpdateSuccess> {
  if (!Number.isInteger(input.purchaseId) || input.purchaseId <= 0) {
    throw new PurchaseOperationError(
      "invalid_purchase_id",
      "Informe um identificador de compra valido.",
      400,
    );
  }

  const reason = input.reason.trim();

  if (!reason) {
    throw new PurchaseOperationError(
      "invalid_update_reason",
      "Informe o motivo da alteracao.",
      400,
    );
  }

  const purchaseDate = parseDateInput(input.purchaseDate);

  if (!purchaseDate) {
    throw new PurchaseOperationError(
      "invalid_purchase_date",
      "Informe uma data da compra valida.",
      400,
    );
  }

  const status = String(input.status ?? "conc")
    .trim()
    .toLowerCase();

  if (!["conc", "pend", "canc"].includes(status)) {
    throw new PurchaseOperationError(
      "invalid_purchase_status",
      "Informe um status de compra valido.",
      400,
    );
  }

  const cpfDigits = normalizeCpfDigits(input.cpf);
  const cpf =
    input.cpf == null || String(input.cpf).trim() === ""
      ? null
      : cpfDigits.length === 11
        ? cpfDigits
        : null;

  if (input.cpf != null && String(input.cpf).trim() !== "" && cpf === null) {
    throw new PurchaseOperationError(
      "invalid_cpf",
      "Informe um CPF valido para a compra.",
      400,
    );
  }

  const vouchersInput = Array.isArray(input.vouchers) ? input.vouchers : [];
  const paymentsInput = Array.isArray(input.payments) ? input.payments : [];
  const { date, time } = getSaoPauloDateParts();
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const purchase = await getPurchaseById(client, input.purchaseId);

    if (!purchase || !["bilhe", "reser"].includes(String(purchase.tpcompra ?? ""))) {
      throw new PurchaseOperationError(
        "purchase_not_found",
        "Compra operacional nao encontrada para edicao.",
        404,
      );
    }

    if (purchase.stcompra === "canc") {
      throw new PurchaseOperationError(
        "purchase_already_cancelled",
        "Use o endpoint de cancelamento para compras canceladas.",
        409,
      );
    }

    const vouchers = await getPurchaseVouchers(client, input.purchaseId);
    const updateById = new Map(
      vouchersInput
        .map(normalizeVoucherPatch)
        .filter((voucher) => Number.isInteger(voucher.id) && voucher.id > 0)
        .map((voucher) => [voucher.id, voucher]),
    );

    const existingPaymentsRaw = await getPurchasePayments(client, input.purchaseId);

    let totalBefore = 0;

    for (const voucher of vouchers) {
      if (voucher.stusado !== "inv") {
        totalBefore += Number(voucher.vlunicompra ?? 0);
      }
    }

    const existingPayments = buildExistingPayments(
      purchase,
      existingPaymentsRaw,
      totalBefore,
    );

    let normalizedPayments =
      paymentsInput.length > 0
        ? paymentsInput
            .map((payment) => ({
              method: String(payment.method ?? "").trim(),
              value: parseMoneyInput(payment.value),
            }))
            .filter(
              (payment): payment is NormalizedPayment =>
                payment.method !== "" && payment.value !== null,
            )
        : existingPayments;

    const affectedVoucherIds: number[] = [];
    const toValidate: Array<{ purchaseId: number; voucherId: number }> = [];
    const toUnvalidate: Array<{ purchaseId: number; voucherId: number }> = [];
    const toInvalidate: Array<{ purchaseId: number; voucherId: number }> = [];
    const voucherChanges: PurchaseUpdateVoucherChange[] = [];
    let totalValue = 0;

    for (const voucher of vouchers) {
      const patch = updateById.get(voucher.idvoucher);
      const oldStatus = normalizeVoucherStatus(voucher.stusado) ?? "n";
      const nextStatus =
        patch?.exclude === true ? "inv" : patch?.status ?? oldStatus;
      const oldDiscountId =
        voucher.desconto_id && Number(voucher.desconto_id) > 0
          ? Number(voucher.desconto_id)
          : null;

      let newDiscountId = oldDiscountId;
      let nextValue = Number(voucher.vlunicompra ?? 0);
      let nextDescription = buildVoucherDescription(
        voucher.tpvoucher,
        null,
        voucher.descricao,
      );

      if (isVoucherDiscountEditable(voucher.tpvoucher)) {
        if (patch?.discountId !== undefined) {
          if (patch.discountId === null || patch.discountId === 0) {
            newDiscountId = null;
          } else if (!Number.isInteger(patch.discountId) || patch.discountId < 0) {
            throw new PurchaseOperationError(
              "invalid_discount_id",
              `Informe um desconto valido para o voucher ${voucher.idvoucher}.`,
              400,
            );
          } else {
            newDiscountId = patch.discountId;
          }
        }

        const currentDiscount =
          oldDiscountId != null ? await getDiscountById(client, oldDiscountId) : null;
        const nextDiscount =
          newDiscountId != null ? await getDiscountById(client, newDiscountId) : null;

        if (newDiscountId != null && !nextDiscount) {
          throw new PurchaseOperationError(
            "discount_not_found",
            `O desconto selecionado para o voucher ${voucher.idvoucher} nao existe.`,
            404,
          );
        }

        const baseValue = resolveVoucherBaseValue(voucher, currentDiscount);
        nextValue = resolveVoucherDiscountedValue(baseValue, nextDiscount);
        nextDescription = buildVoucherDescription(
          voucher.tpvoucher,
          nextDiscount,
          voucher.descricao,
        );
      } else {
        newDiscountId = oldDiscountId;
        nextDescription = buildVoucherDescription(
          voucher.tpvoucher,
          null,
          voucher.descricao,
        );

        if (patch && patch.value !== undefined) {
          const parsedValue = parseMoneyInput(patch.value);

          if (parsedValue === null || parsedValue < 0) {
            throw new PurchaseOperationError(
              "invalid_voucher_value",
              `Informe um valor valido para o voucher ${voucher.idvoucher}.`,
              400,
            );
          }

          nextValue = parsedValue;
        }
      }

      if (nextStatus !== "inv") {
        totalValue += nextValue;
      }

      const currentValue = Number(voucher.vlunicompra ?? 0);
      const currentDescription = String(voucher.descricao ?? "");
      const fieldPatch: Parameters<typeof updateVoucherFields>[2] = {};
      let voucherChanged = false;

      if (Math.abs(nextValue - currentValue) > 0.0001) {
        fieldPatch.value = nextValue;
        voucherChanged = true;
      }

      if ((newDiscountId ?? 0) !== (oldDiscountId ?? 0)) {
        fieldPatch.discountId = newDiscountId;
        voucherChanged = true;
      }

      if (nextDescription !== currentDescription) {
        fieldPatch.description = nextDescription;
        voucherChanged = true;
      }

      if (nextStatus !== oldStatus) {
        fieldPatch.status = nextStatus;
        voucherChanged = true;

        if (nextStatus === "n") {
          fieldPatch.date = null;
          fieldPatch.time = null;
        } else {
          fieldPatch.date = date;
          fieldPatch.time = time;
        }

        affectedVoucherIds.push(voucher.idvoucher);

        if (nextStatus === "s") {
          toValidate.push({
            purchaseId: input.purchaseId,
            voucherId: voucher.idvoucher,
          });
        } else if (nextStatus === "n" && oldStatus === "s") {
          toUnvalidate.push({
            purchaseId: input.purchaseId,
            voucherId: voucher.idvoucher,
          });
        } else if (nextStatus === "inv" && oldStatus === "s") {
          toInvalidate.push({
            purchaseId: input.purchaseId,
            voucherId: voucher.idvoucher,
          });
        }
      }

      if (voucherChanged) {
        voucherChanges.push({
          voucherId: voucher.idvoucher,
          voucherNumber: voucher.numvoucher,
          voucherType: voucher.tpvoucher,
          oldStatus,
          newStatus: nextStatus,
          oldValue: currentValue.toFixed(2),
          newValue: nextValue.toFixed(2),
          oldDiscountId,
          newDiscountId,
          oldDescription: currentDescription,
          newDescription: nextDescription,
        });
      }

      await updateVoucherFields(client, voucher.idvoucher, fieldPatch);
    }

    if (
      normalizedPayments.length === 0 &&
      paymentsInput.length === 0 &&
      totalValue > 0.0001
    ) {
      const fallbackMethod = String(purchase.formapag ?? "").trim();

      if (fallbackMethod && fallbackMethod.toUpperCase() !== "N/A") {
        normalizedPayments = [
          {
            method: fallbackMethod,
            value: roundMoney(totalValue),
          },
        ];
      }
    }

    if (totalValue > 0.0001 && normalizedPayments.length === 0) {
      throw new PurchaseOperationError(
        "invalid_payments",
        "Informe ao menos uma forma de pagamento.",
        400,
      );
    }

    const paymentTotal = normalizedPayments.reduce(
      (sum, payment) => sum + payment.value,
      0,
    );

    if (
      normalizedPayments.length > 0 &&
      Math.abs(paymentTotal - totalValue) > 0.01
    ) {
      throw new PurchaseOperationError(
        "invalid_payments_total",
        "Total das formas de pagamento diferente do valor da venda.",
        409,
      );
    }

    const firstPaymentMethod =
      normalizedPayments[0]?.method ??
      (totalValue <= 0.0001 ? "corte" : purchase.formapag ?? null);

    const beforePaymentsLog = normalizeAuditPayments(existingPayments);
    const afterPaymentsLog = normalizeAuditPayments(normalizedPayments);
    const purchaseMessages: string[] = [];
    const purchaseDateBefore = String(purchase.dtcompra ?? "").slice(0, 10) || null;
    const cpfBefore = purchase.cpf ? normalizeCpfDigits(purchase.cpf) : null;
    const purchaseStatusBefore = String(purchase.stcompra ?? "").trim().toLowerCase();
    const purchaseTotalBefore = Number(purchase.vltotcompra ?? 0);

    if (purchaseDate !== purchaseDateBefore) {
      purchaseMessages.push(
        `Data alterada de ${formatNullable(purchaseDateBefore)} para ${purchaseDate}`,
      );
    }

    if (cpf !== cpfBefore) {
      purchaseMessages.push(
        `CPF alterado de ${formatNullable(cpfBefore)} para ${formatNullable(cpf)}`,
      );
    }

    if (status !== purchaseStatusBefore) {
      purchaseMessages.push(
        `Status alterado de ${formatStatusLabel(purchaseStatusBefore)} para ${formatStatusLabel(status)}`,
      );
    }

    if (Math.abs(totalValue - purchaseTotalBefore) > 0.0001) {
      purchaseMessages.push(
        `Valor alterado de ${formatMoney(purchaseTotalBefore)} para ${formatMoney(totalValue)}`,
      );
    }

    if (paymentsForLog(beforePaymentsLog) !== paymentsForLog(afterPaymentsLog)) {
      purchaseMessages.push(
        `Pagamentos alterados de [${paymentsForLog(beforePaymentsLog) || "-"}] para [${paymentsForLog(afterPaymentsLog) || "-"}]`,
      );
    }

    const allMessages = [
      ...purchaseMessages,
      ...buildVoucherChangeMessages(voucherChanges),
    ];

    if (allMessages.length === 0) {
      await client.query("ROLLBACK");

      return {
        action: "update",
        purchaseId: input.purchaseId,
        status,
        totalValue: purchaseTotalBefore.toFixed(2),
        paymentMethods: [],
        affectedVoucherIds: [],
        warnings: [],
        message: "Nenhuma alteracao detectada.",
        auditLogId: null,
        unchanged: true,
      };
    }

    await updatePurchaseSummary(client, input.purchaseId, {
      status,
      purchaseDate,
      cpf,
      totalValue,
      firstPaymentMethod,
    });
    await replacePurchasePayments(client, input.purchaseId, normalizedPayments);

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "compra",
      acao: "editar",
      compraId: input.purchaseId,
      descricao: buildAuditDescription(allMessages),
      motivo: reason,
      usuarioNome: buildAuditActorName(input.actor),
      detalhes: {
        via: "apps/web",
        antes: {
          status: purchaseStatusBefore,
          dtcompra: purchaseDateBefore,
          cpf: cpfBefore,
          total: purchaseTotalBefore.toFixed(2),
          pagamentos: beforePaymentsLog,
        },
        depois: {
          status,
          dtcompra: purchaseDate,
          cpf,
          total: totalValue.toFixed(2),
          pagamentos: afterPaymentsLog,
        },
        vouchers: voucherChanges,
        mudancas: allMessages,
        actor: {
          name: String(input.actor?.name ?? "").trim() || null,
          cpf: normalizeCpfDigits(input.actor?.cpf ?? "") || null,
        },
      },
    });

    await client.query("COMMIT");

    console.info("ops-purchase-update", {
      purchaseId: input.purchaseId,
      reason,
      status,
      purchaseDate,
      cpf,
      totalValue: totalValue.toFixed(2),
      actorName: String(input.actor?.name ?? "").trim() || null,
      actorCpf: String(input.actor?.cpf ?? "").trim() || null,
      affectedVoucherIds,
      auditLogId,
    });

    const warnings: string[] = [];

    for (const [action, pairs] of [
      ["validate", toValidate],
      ["unvalidate", toUnvalidate],
      ["invalidate", toInvalidate],
    ] as const) {
      if (pairs.length === 0) {
        continue;
      }

      const sync = await syncTicketValidation(pairs, action);

      if (sync.status !== "sent") {
        warnings.push(
          `Aviso: sincronizacao com o servico de tickets nao concluida para ${action} (${sync.skippedReason ?? "ticket_sync_failed"}).`,
        );
      }
    }

    return {
      action: "update",
      purchaseId: input.purchaseId,
      status,
      totalValue: totalValue.toFixed(2),
      paymentMethods: normalizedPayments.map((payment) => payment.method),
      affectedVoucherIds,
      warnings,
      message: "Alteracoes salvas.",
      auditLogId,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
