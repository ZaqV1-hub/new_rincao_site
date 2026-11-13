import { getCieloSaleByPaymentId, isCieloEcommerceConfigured } from "@/lib/cielo-ecommerce";
import type { CieloChargebackCase } from "@/lib/chargeback-contract";
import type { PoolClient } from "pg";
import { getIngressoDbPool, getIngressoSistemaDbDialect, getIngressoSistemaDbPool } from "@/lib/ingresso-db";

type PaymentRow = {
  purchase_id: number;
  payment_id: string;
  ledger_status: number | string | null;
  cancellation_source?: string | null;
  payload: unknown;
};

type Payment = {
  id: string;
  tid: string;
  nsu: string;
  authorization: string;
  establishment: string;
  receivedAt: string;
  capturedAt: string;
  status: string;
  ledgerStatus: string;
  amountCents: number | null;
  reversedCents: number | null;
  reversalRecorded: boolean;
  installments: number | null;
  brand: string;
  lastFour: string;
  eci: string;
  eciSources?: { payment: string; externalAuthentication: string; conflict: boolean };
  holderName?: string;
  buyerDocumentMasked?: string;
  authentication?: {
    version: string;
    referencePresent: boolean;
    cavvPresent: boolean;
    requested: boolean | null;
    dataOnly: boolean | null;
  };
  buyerName: string;
  buyerEmail: string;
  merchantOrderId: string;
};

type PaymentAttempt = Payment | Pick<Payment, "status" | "ledgerStatus" | "amountCents">;

type Voucher = {
  id: number;
  number: string;
  category: string;
  visitDate: string;
  unitCents: number | null;
  state: "used" | "available" | "invalidated" | "unknown";
  usedAt: string | null;
  invalidatedAt: string | null;
};

type AuditRow = {
  id: number;
  purchase_id: number | null;
  action: string;
  occurred_at: Date | string | null;
  actor_name: string | null;
  details: string | null;
};

type AuditEvent = {
  id: number;
  action: string;
  occurredAt: string | null;
  voucherIds: number[];
};

export type ChargebackEvidence = {
  case: CieloChargebackCase;
  customerHistory?: {
    accounts: { source: "usuario" | "usuario_site_conta"; registeredOn: string; lastLoginAt: string | null }[];
    previousPurchases: { total: number; completed: number; cancelled: number; other: number; firstDate: string; lastDate: string } | null;
  };
  purchaseId: number | null;
  paymentId: string | null;
  capturedAt: string;
  issues: string[];
  link: { method: "tid" | "nsu_authorization_date"; establishmentVerified: boolean } | null;
  purchase: {
    date: string;
    totalCents: number | null;
    status: string;
    buyerName: string;
    buyerEmail: string;
  } | null;
  paymentAttempts: PaymentAttempt[];
  livePayment: Payment | null;
  livePaymentCheckedAt: string | null;
  vouchers: Voucher[];
  voucherEvents: (AuditEvent & { mode: string; actor: string })[];
  deliveryEvents: (AuditEvent & { trigger: string })[];
  emailQueued: boolean | null;
  communicationsCapturedAt: string | null;
};

function object(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }

  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizedIdentifier(value: string) {
  return /^\d+$/.test(value) ? value.replace(/^0+(?=\d)/, "") : value;
}

function cents(value: unknown) {
  const amount = text(value);
  const number = Number(amount);
  return /^\d+$/.test(amount) && Number.isSafeInteger(number) ? number : null;
}

function brlCents(value: unknown) {
  const amount = text(value);
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) return null;
  const [reais, decimals = ""] = amount.split(".");
  return cents(reais + decimals.padEnd(2, "0"));
}

function datePart(value: string) {
  return /^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(value) ? value.slice(0, 10) : "";
}

function lastFour(value: unknown) {
  return text(value).match(/(\d{4})$/)?.[1] ?? "";
}

function eciValue(value: unknown) {
  const candidate = text(value);
  return /^\d{1,2}$/.test(candidate) ? candidate : "";
}

function declaredHolder(value: unknown) {
  const candidate = text(value).replace(/\s+/g, " ");
  return /^[\p{L}\p{M} .’'\-]{1,120}$/u.test(candidate) ? candidate : "";
}

function maskedDocument(value: unknown) {
  const candidate = text(value);
  if (!/^[\d.\-/ ]+$/.test(candidate)) return "";
  const digits = candidate.replace(/\D/g, "");
  if (digits.length === 11) return `***.***.***-${digits.slice(-2)}`;
  if (digits.length === 14) return `**.***.***/****-${digits.slice(-2)}`;
  return "";
}

function readPayment(row: PaymentRow): Payment {
  const envelope = object(row.payload);
  const dados = Array.isArray(envelope.dados) ? object(envelope.dados[0]) : object(envelope.dados);
  const raw = object(dados.xml ?? envelope.xml ?? envelope.dados ?? envelope);
  const sale = object(raw.sale ?? raw.Sale ?? raw.order ?? raw);
  const paymentList = sale.Payments ?? sale.payments;
  const payment = object(sale.Payment ?? sale.payment ?? sale.paymentData ??
    (Array.isArray(paymentList) ? paymentList.find((item) => {
      const candidate = object(item);
      return text(candidate.PaymentId ?? candidate.paymentId) === text(row.payment_id);
    }) : undefined));
  const customer = object(sale.Customer ?? sale.customer);
  const card = object(payment.CreditCard ?? payment.DebitCard ?? payment.creditCard ?? payment.debitCard);
  const authentication = object(payment.ExternalAuthentication ?? payment.externalAuthentication);
  const rootEci = eciValue(payment.Eci ?? payment.eci);
  const externalEci = eciValue(authentication.Eci ?? authentication.eci);
  const eciConflict = Boolean(rootEci && externalEci && Number(rootEci) !== Number(externalEci));
  const version = text(authentication.Version ?? authentication.version);
  const requested = payment.Authenticate ?? payment.authenticate;
  const dataOnly = authentication.DataOnly ?? authentication.dataOnly;
  const reversedCents = cents(payment.VoidedAmount ?? payment.voidedAmount ?? payment.RefundedAmount ?? payment.refundedAmount);
  const status = text(payment.Status ?? payment.status);
  const reversals = payment.Voids ?? payment.voids ?? payment.Refunds ?? payment.refunds;
  return {
    id: text(payment.PaymentId ?? payment.paymentId),
    tid: text(payment.Tid ?? payment.TID ?? payment.tid ?? sale.Tid ?? sale.TID ?? sale.tid),
    nsu: text(payment.ProofOfSale ?? payment.proofOfSale ?? payment.NSU ?? payment.Nsu ?? payment.nsu),
    authorization: text(payment.AuthorizationCode ?? payment.authorizationCode),
    establishment: text(payment.EstablishmentNumber ?? payment.establishmentNumber ?? sale.EstablishmentNumber ?? sale.establishmentNumber),
    receivedAt: text(payment.ReceivedDate ?? payment.receivedDate ?? payment.CreatedDate ?? payment.createdDate),
    capturedAt: text(payment.CapturedDate ?? payment.capturedDate),
    status,
    ledgerStatus: text(row.ledger_status),
    amountCents: cents(payment.Amount ?? payment.amount),
    reversedCents,
    reversalRecorded: Boolean(reversedCents || /^(10|11|voided|refunded|cancelled|canceled)$/i.test(status) ||
      (Array.isArray(reversals) && reversals.length) || text(row.cancellation_source) === "portal" ||
      ["6", "7"].includes(text(row.ledger_status)) && /^(2|paymentconfirmed)$/i.test(status)),
    installments: cents(payment.Installments ?? payment.installments),
    brand: text(card.Brand ?? card.brand),
    lastFour: lastFour(card.CardNumber ?? card.cardNumber),
    eci: eciConflict ? "" : externalEci || rootEci,
    eciSources: { payment: rootEci, externalAuthentication: externalEci, conflict: eciConflict },
    holderName: declaredHolder(card.Holder ?? card.holder),
    buyerDocumentMasked: maskedDocument(customer.Identity ?? customer.identity),
    authentication: {
      version: /^\d\.\d(?:\.\d)?$/.test(version) ? version : "",
      referencePresent: Boolean(text(authentication.ReferenceId ?? authentication.referenceId)),
      cavvPresent: Boolean(text(authentication.Cavv ?? authentication.cavv)),
      requested: typeof requested === "boolean" ? requested : null,
      dataOnly: typeof dataOnly === "boolean" ? dataOnly : null,
    },
    buyerName: text(customer.Name ?? customer.name ?? object(dados.sender).name),
    buyerEmail: text(customer.Email ?? customer.email ?? object(dados.sender).email),
    merchantOrderId: text(sale.MerchantOrderId ?? sale.merchantOrderId ?? sale.OrderNumber ?? sale.orderNumber),
  };
}

function conflictsWithCase(payment: Payment, chargeback: CieloChargebackCase, purchaseId: number) {
  const transaction = chargeback.transactionDetails;
  const fields = [
    [payment.tid, transaction.tid],
    [payment.establishment, chargeback.establishmentNumber],
    [normalizedIdentifier(payment.nsu), normalizedIdentifier(transaction.nsu)],
    [normalizedIdentifier(payment.authorization), normalizedIdentifier(transaction.authorization)],
    [datePart(payment.receivedAt), datePart(transaction.transactionDate)],
    [payment.lastFour, lastFour(transaction.truncatedCard)],
    [payment.merchantOrderId, String(purchaseId)],
  ];
  return fields.some(([recorded, notified]) => recorded && notified && recorded !== notified);
}

function auditTime(value: AuditRow["occurred_at"]) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  return datePart(text(value)) ? text(value) : null;
}

function localVoucherTime(dateValue: string | null, timeValue: string | null) {
  const date = datePart(text(dateValue));
  const time = text(timeValue);
  return date && /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?$/.test(time) ? `${date} ${time}` : null;
}

function scopedVoucherIds(value: unknown, purchaseVoucherIds: Set<number>) {
  return Array.isArray(value)
    ? [...new Set(value.map(Number).filter((id) => purchaseVoucherIds.has(id)))].sort((a, b) => a - b)
    : [];
}

function safeCase(value: CieloChargebackCase): CieloChargebackCase {
  const transaction = value.transactionDetails;
  const card = lastFour(transaction.truncatedCard);
  return {
    idCase: value.idCase,
    idChargeback: value.idChargeback,
    establishmentNumber: value.establishmentNumber,
    treatmentDeadline: value.treatmentDeadline,
    transactionAmount: value.transactionAmount,
    process: value.process,
    transactionDetails: {
      tid: transaction.tid,
      nsu: transaction.nsu,
      authorization: transaction.authorization,
      transactionDate: transaction.transactionDate,
      truncatedCard: card ? `**** ${card}` : "",
      cardAssociationName: transaction.cardAssociationName,
      currency: transaction.currency,
    },
    chargebackDetails: {
      reasonCode: value.chargebackDetails.reasonCode,
      reasonDescription: value.chargebackDetails.reasonDescription,
    },
    remoteStatus: value.remoteStatus,
  };
}

async function loadAuditRows(
  pool: ReturnType<typeof getIngressoDbPool>,
  sql: string,
  params: unknown[],
) {
  try {
    return (await pool.query<AuditRow>(sql, params)).rows;
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === "42P01" || code === "ER_NO_SUCH_TABLE") return null;
    throw error;
  }
}

async function collectSystemEvidence(
  system: PoolClient,
  chargeback: CieloChargebackCase,
  mysql: boolean,
): Promise<ChargebackEvidence> {
  const evidence: ChargebackEvidence = {
    case: safeCase(chargeback),
    purchaseId: null,
    paymentId: null,
    capturedAt: new Date().toISOString(),
    issues: [],
    link: null,
    purchase: null,
    paymentAttempts: [],
    livePayment: null,
    livePaymentCheckedAt: null,
    vouchers: [],
    voucherEvents: [],
    deliveryEvents: [],
    emailQueued: null,
    communicationsCapturedAt: null,
  };
  const xmlColumn = mysql ? "xmlRequisicao" : '"xmlRequisicao"';
  const cancellationColumn = mysql ? "cancellationSource" : '"cancellationSource"';
  const paymentColumns = `idcompra AS purchase_id, idpagseguro AS payment_id, status AS ledger_status,
    ${cancellationColumn} AS cancellation_source, ${xmlColumn} AS payload`;
  const textColumn = (column: string) => mysql ? `CAST(${column} AS CHAR)` : `${column}::text`;
  const transaction = chargeback.transactionDetails;
  const nsu = normalizedIdentifier(transaction.nsu);
  const authorization = normalizedIdentifier(transaction.authorization);
  const transactionDate = datePart(transaction.transactionDate);

  // The legacy column also contains XML and malformed historical records.
  // Use a text prefilter, then require exact identifiers in the parsed Cielo response.
  const candidates = await system.query<PaymentRow>(
    `SELECT ${paymentColumns} FROM pagpagseguro
     WHERE ($1 <> '' AND POSITION($1 IN ${xmlColumn}) > 0)
        OR ($2 <> '' AND $3 <> '' AND POSITION($2 IN ${xmlColumn}) > 0
           AND POSITION($3 IN ${xmlColumn}) > 0)`,
    [transaction.tid, nsu, authorization],
  );
  const exact = [];
  const fallback = [];
  for (const row of candidates.rows) {
    const payment = readPayment(row);
    const candidate = { row, payment };
    if (transaction.tid && payment.tid === transaction.tid) {
      exact.push(candidate);
    } else if ((!transaction.tid || !payment.tid) && nsu && authorization && transactionDate &&
      normalizedIdentifier(payment.nsu) === nsu && normalizedIdentifier(payment.authorization) === authorization &&
      datePart(payment.receivedAt) === transactionDate &&
      payment.establishment && payment.establishment === chargeback.establishmentNumber) {
      fallback.push(candidate);
    }
  }

  const matches = exact.length ? exact : fallback;
  const match = matches[0];
  if (matches.length !== 1) {
    evidence.issues.push(match ? "ambiguous_transaction" : "transaction_not_found");
    return evidence;
  }

  const { row, payment } = match;
  const purchaseId = Number(row.purchase_id);
  const paymentId = text(row.payment_id);
  if (!Number.isSafeInteger(purchaseId) || purchaseId <= 0 || !paymentId || payment.id !== paymentId ||
    conflictsWithCase(payment, chargeback, purchaseId)) {
    evidence.issues.push("transaction_conflict");
    return evidence;
  }

  evidence.purchaseId = purchaseId;
  evidence.paymentId = paymentId;
  evidence.link = {
    method: exact.length ? "tid" : "nsu_authorization_date",
    establishmentVerified: Boolean(payment.establishment),
  };

  const [purchaseResult, attemptResult, voucherResult, auditTable] = await Promise.all([
    system.query<{
      purchase_date: string | null; total: string | null; status: string | null;
      buyer_name: string | null; buyer_email: string | null;
    }>(`SELECT ${textColumn("c.dtcompra")} AS purchase_date, ${textColumn("c.vltotcompra")} AS total, c.stcompra AS status,
               u.nmusuario AS buyer_name, u.email AS buyer_email
        FROM compra c LEFT JOIN usuario u ON u.cpf = c.cpf WHERE c.idcompra = $1`, [purchaseId]),
    system.query<PaymentRow>(`SELECT ${paymentColumns} FROM pagpagseguro
      WHERE idcompra = $1 ORDER BY idpagseguro`, [purchaseId]),
    system.query<{
      voucher_id: number; voucher_number: string | null; voucher_type: string | null;
      visit_date: string | null; unit_value: string | null; state: string | null;
      use_date: string | null; use_time: string | null;
    }>(`SELECT v.idvoucher AS voucher_id, v.numvoucher AS voucher_number,
               COALESCE(NULLIF(v.descricao, ''), v.tpvoucher) AS voucher_type,
               ${textColumn("a.dtagenda")} AS visit_date, ${textColumn("v.vlunicompra")} AS unit_value,
               v.stusado AS state, ${textColumn("v.dtuso")} AS use_date, ${textColumn("v.hruso")} AS use_time
        FROM voucher v LEFT JOIN agenda a ON a.idagenda = v.idagenda
        WHERE v.idcompra = $1 ORDER BY v.idvoucher`, [purchaseId]),
    system.query<{ regclass: string | null }>("SELECT to_regclass('edicoes_log') AS regclass"),
  ]);

  const purchase = purchaseResult.rows[0];
  if (purchaseResult.rows.length !== 1) evidence.issues.push("purchase_record_incomplete");
  if (purchase) evidence.purchase = {
    date: datePart(text(purchase.purchase_date)),
    totalCents: brlCents(purchase.total),
    status: text(purchase.status),
    buyerName: text(purchase.buyer_name),
    buyerEmail: text(purchase.buyer_email),
  };

  // Only current account metadata exists; it is not a session or cardholder-authentication history.
  const cpfCondition = `c.cpf ${mysql ? "REGEXP" : "~"} '^[0-9]{11}$'`;
  const siteAccountTable = await system.query<{ regclass: string | null }>("SELECT to_regclass('usuario_site_conta') AS regclass");
  const accountSources: ("usuario" | "usuario_site_conta")[] = ["usuario"];
  if (siteAccountTable.rows[0]?.regclass) accountSources.push("usuario_site_conta");
  const accounts: NonNullable<ChargebackEvidence["customerHistory"]>["accounts"] = [];
  for (const source of accountSources) {
    const rows = await system.query<{ registered_on: string | null; last_login_date: string | null; last_login_time: string | null }>(
      `SELECT ${textColumn("u.dtcadastro")} AS registered_on,
              ${textColumn("u.dtulogin")} AS last_login_date, ${textColumn("u.hrulogin")} AS last_login_time
       FROM compra c JOIN ${source} u ON u.cpf = c.cpf WHERE c.idcompra = $1 AND ${cpfCondition}`, [purchaseId],
    );
    if (rows.rows.length === 1) accounts.push({
      source,
      registeredOn: datePart(text(rows.rows[0].registered_on)),
      lastLoginAt: localVoucherTime(rows.rows[0].last_login_date, rows.rows[0].last_login_time),
    });
  }
  const previous = transactionDate && evidence.purchase?.date ? (await system.query<{
    previous_purchase_count: string; completed: string; cancelled: string; other: string; first_date: string | null; last_date: string | null;
  }>(`SELECT COUNT(p.idcompra) AS previous_purchase_count,
        SUM(CASE WHEN LOWER(p.stcompra) = 'conc' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN LOWER(p.stcompra) IN ('canc', 'esto') THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN p.idcompra IS NOT NULL AND (p.stcompra IS NULL OR LOWER(p.stcompra) NOT IN ('conc', 'canc', 'esto')) THEN 1 ELSE 0 END) AS other,
        ${textColumn("MIN(p.dtcompra)")} AS first_date, ${textColumn("MAX(p.dtcompra)")} AS last_date
      FROM compra c LEFT JOIN compra p ON p.cpf = c.cpf AND p.idcompra <> c.idcompra
        AND p.dtcompra < c.dtcompra AND p.dtcompra < $2
      WHERE c.idcompra = $1 AND ${cpfCondition} GROUP BY c.idcompra`, [purchaseId, transactionDate])).rows[0] : undefined;
  evidence.customerHistory = {
    accounts,
    previousPurchases: previous ? {
      total: Number(previous.previous_purchase_count), completed: Number(previous.completed), cancelled: Number(previous.cancelled), other: Number(previous.other),
      firstDate: datePart(text(previous.first_date)), lastDate: datePart(text(previous.last_date)),
    } : null,
  };

  evidence.paymentAttempts = attemptResult.rows.map((attempt) => {
    const parsed = readPayment(attempt);
    if (text(attempt.payment_id) === paymentId) return { ...parsed, id: paymentId };
    return { status: parsed.status, ledgerStatus: parsed.ledgerStatus, amountCents: parsed.amountCents };
  });
  const current = attemptResult.rows.filter((attempt) => text(attempt.payment_id) === paymentId);
  if (current.length !== 1 || JSON.stringify(readPayment(current[0])) !== JSON.stringify(payment)) {
    evidence.issues.push("transaction_changed_during_collection");
  }

  evidence.vouchers = voucherResult.rows.map((voucher) => {
    const state = text(voucher.state).toLowerCase();
    const recordedAt = localVoucherTime(voucher.use_date, voucher.use_time);
    return {
      id: Number(voucher.voucher_id),
      number: text(voucher.voucher_number),
      category: text(voucher.voucher_type),
      visitDate: datePart(text(voucher.visit_date)),
      unitCents: brlCents(voucher.unit_value),
      state: state === "s" ? "used" : state === "n" ? "available" : state === "inv" ? "invalidated" : "unknown",
      usedAt: state === "s" ? recordedAt : null,
      invalidatedAt: state === "inv" ? recordedAt : null,
    };
  });

  const voucherIds = new Set(evidence.vouchers.map((voucher) => voucher.id));
  const auditRows = auditTable.rows[0]?.regclass ? (await system.query<AuditRow>(`SELECT id, compra_id AS purchase_id, acao AS action,
    created_at AS occurred_at, usuario_nome AS actor_name, detalhes_json AS details FROM edicoes_log
    WHERE origem = 'voucher' AND acao IN ('validar', 'desvalidar', 'invalidar')
      AND (compra_id = $1 OR POSITION($2 IN detalhes_json) > 0
        OR EXISTS (SELECT 1 FROM voucher
          WHERE voucher.idcompra = $1 AND POSITION(${textColumn("voucher.idvoucher")} IN detalhes_json) > 0))
    ORDER BY created_at, id`, [purchaseId, String(purchaseId)])).rows : [];

  for (const row of auditRows) {
    const details = object(row.details);
    const affected = scopedVoucherIds(details.affectedVoucherIds, voucherIds);
    const linkedPurchase = Number(row.purchase_id) === purchaseId ||
      (Array.isArray(details.purchaseIds) && details.purchaseIds.some((id) => Number(id) === purchaseId));
    if (!linkedPurchase && !affected.length) continue;
    const occurredAt = auditTime(row.occurred_at);
    if (!occurredAt || !affected.length) evidence.issues.push("voucher_audit_incomplete");
    const actor = text(row.actor_name).replace(/\s*\(\d{11}\)$/, "");
    evidence.voucherEvents.push({
      id: Number(row.id),
      action: row.action,
      occurredAt,
      voucherIds: affected,
      mode: ["voucher_number", "purchase", "school_trip", "selection"].includes(text(details.mode))
        ? text(details.mode) : "",
      actor: /^\d{11}$/.test(actor) ? "" : actor,
    });
  }

  evidence.issues = [...new Set(evidence.issues)];
  return evidence;
}

export async function collectChargebackEvidence(chargeback: CieloChargebackCase): Promise<ChargebackEvidence> {
  const mysql = getIngressoSistemaDbDialect() === "mysql";
  const client = await getIngressoSistemaDbPool().connect();
  let evidence: ChargebackEvidence;
  try {
    if (mysql) {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await client.query("START TRANSACTION READ ONLY");
    } else {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    }
    evidence = await collectSystemEvidence(client, chargeback, mysql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  const { purchaseId, paymentId, link } = evidence;
  const payment = evidence.paymentAttempts.find((attempt): attempt is Payment => "id" in attempt && attempt.id === paymentId);
  if (!purchaseId || !paymentId || !link || !payment) return evidence;
  const transactionDate = datePart(chargeback.transactionDetails.transactionDate);

  if (isCieloEcommerceConfigured()) {
    let latest: unknown;
    try {
      latest = await getCieloSaleByPaymentId(paymentId);
      evidence.livePaymentCheckedAt = new Date().toISOString();
    } catch (error) {
      // Cielo e-commerce exposes only the last three months. Historical local
      // evidence remains useful when the charge is outside that query window.
      const queryWindowEnd = new Date(transactionDate + "T00:00:00Z");
      queryWindowEnd.setUTCMonth(queryWindowEnd.getUTCMonth() + 3);
      const notFound = error instanceof Error && error.message.startsWith("cielo_ecommerce_error_404:");
      if (!notFound || !(queryWindowEnd.getTime() < Date.now())) {
        throw new Error("chargeback_payment_refresh_failed");
      }
    }

    if (latest !== undefined) {
      const live = readPayment({ purchase_id: purchaseId, payment_id: paymentId, payload: latest, ledger_status: null });
      if (live.id !== paymentId || conflictsWithCase(live, chargeback, purchaseId) ||
        (live.tid && payment.tid && live.tid !== payment.tid) ||
        (live.amountCents !== null && payment.amountCents !== null && live.amountCents !== payment.amountCents)) {
        evidence.issues.push("live_transaction_conflict");
      } else {
        evidence.livePayment = live;
        link.establishmentVerified ||= Boolean(live.establishment);
      }
    }
  }

  const communications = getIngressoDbPool();
  const voucherIds = new Set(evidence.vouchers.map((voucher) => voucher.id));
  const [emailResult, deliveryRows] = await Promise.all([
    communications.query<{ flenvio: string | null }>(
      "SELECT flenvio FROM compra WHERE idcompra = $1", [purchaseId],
    ),
    loadAuditRows(communications, `SELECT id, compra_id AS purchase_id, acao AS action,
      created_at AS occurred_at, detalhes_json AS details FROM edicoes_log
      WHERE origem = 'ticket-delivery' AND compra_id = $1 ORDER BY created_at, id`, [purchaseId]),
  ]);
  evidence.communicationsCapturedAt = new Date().toISOString();

  evidence.deliveryEvents = (deliveryRows ?? []).map((row) => {
    const details = object(row.details);
    return {
      id: Number(row.id),
      action: row.action,
      occurredAt: auditTime(row.occurred_at),
      voucherIds: scopedVoucherIds(details.sentVoucherIds, voucherIds),
      trigger: ["payment_reconciliation", "delivery_recovery"].includes(text(details.trigger))
        ? text(details.trigger) : "",
    };
  });
  const email = text(emailResult.rows[0]?.flenvio).toLowerCase();
  evidence.emailQueued = email === "sim" ? true : email === "nao" ? false : null;
  evidence.issues = [...new Set(evidence.issues)];
  return evidence;
}

function serviceNotReceived(chargeback: CieloChargebackCase) {
  const brand = chargeback.transactionDetails.cardAssociationName.toLowerCase().trim();
  const reason = chargeback.chargebackDetails.reasonCode.trim();
  // Cielo publishes legacy 131 (Visa) and 4859 (Mastercard). Visa and Mastercard
  // document 13.1 and 4855 respectively. Mastercard 4853 covers multiple disputes.
  return (brand === "visa" && ["13.1", "131"].includes(reason)) ||
    (["master", "mastercard", "master card"].includes(brand) && ["4855", "4859"].includes(reason));
}

function captured(payment: PaymentAttempt) {
  return /^(2|paymentconfirmed|paid|confirmed|completed)$/i.test(payment.status);
}

export function evaluateChargebackEvidence(evidence: ChargebackEvidence) {
  const issues = new Set(evidence.issues);
  const chargeback = evidence.case;
  const payment = evidence.paymentAttempts.find((attempt): attempt is Payment => "id" in attempt && attempt.id === evidence.paymentId);
  const notifiedCents = brlCents(chargeback.transactionAmount);
  if (!evidence.link || !evidence.purchaseId || !payment) issues.add("unverified_purchase_payment");
  const liveTidVerified = evidence.link?.method === "tid" && evidence.livePayment?.id === evidence.paymentId &&
    Boolean(evidence.livePayment?.tid && evidence.livePayment.tid === chargeback.transactionDetails.tid);
  if (evidence.link && !evidence.link.establishmentVerified && !liveTidVerified) {
    issues.add("establishment_unverified");
  }
  if (!["PRIMEIRO_CHARGEBACK", "1"].includes(chargeback.process?.trim().toUpperCase() ?? "")) {
    issues.add("unsupported_process");
  }
  if (!["REAL", "BRL", "986"].includes(chargeback.transactionDetails.currency?.trim().toUpperCase() ?? "")) {
    issues.add("unsupported_currency");
  }
  if (!serviceNotReceived(chargeback)) issues.add("unsupported_reason");
  if (chargeback.remoteStatus !== "PENDING") issues.add("case_not_pending");
  if (!payment || !captured(payment) || (evidence.livePayment && !captured(evidence.livePayment))) {
    issues.add("payment_capture_unconfirmed");
  }
  if (payment?.reversalRecorded || evidence.livePayment?.reversalRecorded ||
    ["canc", "esto"].includes(evidence.purchase?.status.toLowerCase() ?? "")) {
    issues.add("payment_reversal");
  }
  if (evidence.paymentAttempts.some((attempt) =>
    (!("id" in attempt) || attempt.id !== evidence.paymentId) &&
    (captured(attempt) || ["3", "4"].includes(attempt.ledgerStatus)))) {
    issues.add("duplicate_capture");
  }

  const purchaseDate = evidence.purchase?.date ?? "";
  const transactionDate = datePart(chargeback.transactionDetails.transactionDate);
  const newestEvent = new Map<number, string>();
  for (const event of evidence.voucherEvents) {
    for (const id of event.voucherIds) newestEvent.set(id, event.action);
  }
  const amountCovered = evidence.vouchers.reduce((total, voucher) => {
    const useDate = datePart(voucher.usedAt ?? "");
    return voucher.state === "used" && useDate && purchaseDate && useDate >= purchaseDate &&
      (!transactionDate || useDate >= transactionDate) &&
      useDate === voucher.visitDate && useDate <= datePart(evidence.capturedAt) &&
      (newestEvent.get(voucher.id) ?? "validar") === "validar"
      ? total + (voucher.unitCents ?? 0)
      : total;
  }, 0);
  if (!notifiedCents || payment?.amountCents !== notifiedCents || evidence.purchase?.totalCents !== notifiedCents ||
    evidence.vouchers.some((voucher) => voucher.unitCents === null) ||
    evidence.vouchers.reduce((total, voucher) => total + (voucher.unitCents ?? 0), 0) !== notifiedCents) {
    issues.add("amount_not_reconciled");
  }
  if (!notifiedCents || amountCovered !== notifiedCents) issues.add("partial_or_unproven_use");

  return {
    eligible: issues.size === 0,
    reason: issues.size === 0 ? "Registros de validação cobrem os ingressos pagos da transação." : [...issues][0],
    issues: [...issues],
    policyVersion: "service-provision-v1",
  };
}

const issueDescriptions = new Map([
  ["ambiguous_transaction", "Mais de um pagamento corresponde aos identificadores da Cielo."],
  ["transaction_not_found", "Nenhum pagamento pôde ser associado aos identificadores da Cielo."],
  ["transaction_conflict", "Os identificadores da Cielo divergem do registro local do pagamento."],
  ["purchase_record_incomplete", "O registro da compra está ausente ou apresenta duplicidade."],
  ["transaction_changed_during_collection", "O registro da cobrança divergiu durante a coleta."],
  ["voucher_audit_incomplete", "Há eventos de auditoria sem data ou sem identificação dos ingressos afetados."],
  ["live_transaction_conflict", "A consulta atual à Cielo retornou dados divergentes da cobrança."],
  ["unverified_purchase_payment", "O vínculo entre a contestação, o pagamento e a compra ainda precisa ser confirmado."],
  ["establishment_unverified", "O vínculo com o estabelecimento informado pela Cielo ainda precisa ser confirmado."],
  ["unsupported_process", "O envio automático exige que a Cielo identifique o caso como primeira contestação."],
  ["unsupported_currency", "O envio automático exige que a Cielo informe o real como moeda da transação."],
  ["unsupported_reason", "O motivo informado pela Cielo exige análise das evidências disponíveis."],
  ["case_not_pending", "A contestação consta como tratada na Cielo."],
  ["payment_capture_unconfirmed", "A captura do pagamento ainda precisa ser confirmada."],
  ["payment_reversal", "Há registro de cancelamento ou estorno da cobrança."],
  ["duplicate_capture", "Há registro de outra cobrança capturada para a mesma compra."],
  ["amount_not_reconciled", "Os valores da transação, da compra e dos ingressos não puderam ser conciliados."],
  ["partial_or_unproven_use", "Os registros de utilização não comprovam a prestação do serviço pelo valor integral da transação."],
  ["chargeback_payment_refresh_failed", "A consulta atual do pagamento à Cielo falhou."],
  ["chargeback_pdf_invalid", "O arquivo gerado falhou na verificação de formato do PDF."],
  ["chargeback_pdf_page_limit", "O dossiê ultrapassa o limite de dez páginas da Cielo."],
  ["chargeback_pdf_size_limit", "O dossiê ultrapassa o limite de 8 MB da Cielo."],
]);

export function describeChargebackIssue(code: string): string {
  return issueDescriptions.get(code) ?? "A verificação encontrou uma inconsistência sem descrição cadastrada.";
}
