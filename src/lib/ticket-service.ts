import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  buildTicketsApiHeaders,
  getTicketsApiBaseUrl,
} from "@/lib/ticket-api";
import { registerTicketDeliveryAudit } from "@/lib/ticket-delivery-audit";
import { resolveVoucherTypeLabel } from "@/lib/voucher-type-label";

type TicketServiceConfig = {
  baseUrl: string;
  username: string;
  password: string;
  testing: boolean;
  timeoutMs: number;
};

type ConfirmedPurchaseRow = {
  idcompra: number;
  cpf: string | null;
  tpcompra: string | null;
  dtcompra: string | null;
  email: string | null;
  nmusuario: string | null;
  celular: string | null;
};

type VoucherTicketRow = {
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

type VoucherCpfSource = {
  identificacao: string | null;
};

type VoucherCodeSource = {
  numvoucher: string | null;
  tpvoucher: string | null;
};

type TicketSendResult = {
  status: "sent" | "skipped";
  purchaseId: number;
  sentVoucherIds: number[];
  skippedReason?: string;
};

type PendingTicketDeliveryPurchaseRow = {
  purchase_id: number;
  pending_vouchers: string;
};

type TicketWhatsappSendResult = {
  status: "sent" | "skipped";
  purchaseId: number;
  sentVoucherIds: number[];
  skippedReason?: string;
};

export type TicketValidationAction = "validate" | "unvalidate" | "invalidate";

type TicketValidationPair = {
  purchaseId: number;
  voucherId: number;
};

type TicketValidationVoucherRow = {
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

type TicketValidationSyncResult = {
  status: "sent" | "skipped";
  action: TicketValidationAction;
  pairs: string[];
  skippedReason?: string;
};

type PendingTicketDeliveryRecoveryItem = {
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

function getConfig(): TicketServiceConfig | null {
  const baseUrl = process.env.INGRESSO_TICKET_API_BASE_URL?.trim() ?? "";
  const username = process.env.INGRESSO_TICKET_API_USERNAME?.trim() ?? "";
  const password = process.env.INGRESSO_TICKET_API_PASSWORD?.trim() ?? "";
  const timeoutMs = Number(process.env.INGRESSO_TICKET_API_TIMEOUT_MS ?? 25000);
  const testing = process.env.INGRESSO_TICKET_API_TESTING === "true";

  if (baseUrl && username && password) {
    return {
      baseUrl: baseUrl.replace(/\/+$/, ""),
      username,
      password,
      testing,
      timeoutMs,
    };
  }

  if (
    process.env.NODE_ENV === "development" &&
    !baseUrl &&
    !username &&
    !password
  ) {
    return {
      baseUrl: "http://127.0.0.1:4120",
      username: "local-ticket-user",
      password: "local-ticket-pass",
      testing: true,
      timeoutMs,
    };
  }

  return null;
}

export function isTicketServiceConfigured() {
  return getConfig() !== null;
}

function resolveLocalTestingBaseUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl);

    if (url.hostname !== "ticket-stub" && url.hostname !== "localhost") {
      return null;
    }

    url.hostname = "127.0.0.1";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function resolveTicketServiceBaseUrls(config: TicketServiceConfig) {
  const baseUrls = [config.baseUrl];

  if (!config.testing) {
    return baseUrls;
  }

  const localTestingBaseUrl = resolveLocalTestingBaseUrl(config.baseUrl);

  if (localTestingBaseUrl && localTestingBaseUrl !== config.baseUrl) {
    baseUrls.push(localTestingBaseUrl);
  }

  if (!baseUrls.includes("http://127.0.0.1:4120")) {
    baseUrls.push("http://127.0.0.1:4120");
  }

  return baseUrls;
}

function isRetryableTicketServiceError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const causeCode =
    error.cause && typeof error.cause === "object" && "code" in error.cause
      ? String((error.cause as { code?: unknown }).code ?? "")
      : "";
  const errorText = `${error.message} ${causeCode}`;

  return /(fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ECONNRESET)/i.test(
    errorText,
  );
}

function shouldSkipTicketServiceError(
  config: TicketServiceConfig,
  error: unknown,
) {
  return config.testing && isRetryableTicketServiceError(error);
}

function digitsOnly(value: string | null | undefined) {
  return String(value ?? "").replace(/\D+/g, "");
}

function normalizeWhatsappNumbers(value: string | undefined) {
  return String(value ?? "")
    .split(",")
    .map((entry) => digitsOnly(entry))
    .filter(Boolean);
}

function validateWhatsappPhoneForEnvironment(phoneNumber: string) {
  if (process.env.INGRESSO_TICKET_API_WHATSAPP_TESTING !== "true") {
    return true;
  }

  const allowedNumbers = normalizeWhatsappNumbers(
    process.env.INGRESSO_TICKET_API_WHATSAPP_ALLOWED_NUMBERS,
  );

  if (allowedNumbers.length === 0 || allowedNumbers.includes(phoneNumber)) {
    return true;
  }

  return false;
}

function resolveVoucherCpf(compraCpf: string | null, voucher: VoucherCpfSource) {
  const purchaseCpf = digitsOnly(compraCpf);

  if (purchaseCpf.length === 11) {
    return purchaseCpf;
  }

  const voucherCpf = digitsOnly(voucher.identificacao);

  return voucherCpf.length === 11 ? voucherCpf : "";
}

function voucherPrefixForType(type: string | null) {
  switch (type) {
    case "norma":
    case "corte":
      return "A";
    case "infan":
      return "C";
    case "isent":
      return "I";
    case "escol":
      return "ESC-";
    case "espec":
      return "E";
    default:
      return "";
  }
}

function normalizeVoucherCode(voucher: VoucherCodeSource) {
  const code = String(voucher.numvoucher ?? "").trim();

  if (!code || !/^\d+$/.test(code)) {
    return code;
  }

  const prefix = voucherPrefixForType(voucher.tpvoucher);

  return prefix && !code.startsWith(prefix) ? `${prefix}${code}` : code;
}

async function ticketRequest(
  config: TicketServiceConfig,
  path: string,
  body: unknown,
  token?: string,
  allowedStatuses: number[] = [200],
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (config.testing) {
    headers["X-Testing"] = "true";
  }

  const baseUrls = resolveTicketServiceBaseUrls(config);
  let lastError: unknown = null;

  for (const [index, baseUrl] of baseUrls.entries()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok || !allowedStatuses.includes(response.status)) {
        throw new Error(`ticket_api_error_${response.status}`);
      }

      return response.json().catch(() => ({}));
    } catch (error) {
      lastError = error;

      if (
        index < baseUrls.length - 1 &&
        isRetryableTicketServiceError(error)
      ) {
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("ticket_api_unreachable");
}

async function websiteTicketRequest(
  path: string,
  body: unknown,
  allowedStatuses: number[] = [200],
) {
  const baseUrl = getTicketsApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: buildTicketsApiHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok || !allowedStatuses.includes(response.status)) {
    throw new Error(`ticket_api_error_${response.status}`);
  }

  return response.json().catch(() => ({}));
}

async function authenticate(config: TicketServiceConfig) {
  const response = await ticketRequest(config, "/login", {
    user: config.username,
    password: config.password,
  });
  const token =
    response && typeof response === "object"
      ? (response as Record<string, unknown>).token
      : null;

  return typeof token === "string" && token ? token : null;
}

async function loadTicketValidationVoucher(
  purchaseId: number,
  voucherId: number,
) {
  const pool = getIngressoDbPool();
  const result = await pool.query<TicketValidationVoucherRow>(
    `
      SELECT
        voucher.idcompra,
        voucher.idvoucher,
        voucher.numvoucher,
        voucher.tpvoucher,
        voucher.vlunicompra::text AS vlunicompra,
        voucher.identificacao,
        agenda.dtagenda::text AS dtagenda,
        compra.cpf,
        compra.tpcompra,
        compra.dtcompra::text AS dtcompra,
        usuario.celular
      FROM voucher
      JOIN compra ON compra.idcompra = voucher.idcompra
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      LEFT JOIN usuario ON usuario.cpf = compra.cpf
      WHERE voucher.idcompra = $1
        AND voucher.idvoucher = $2
      LIMIT 1
    `,
    [purchaseId, voucherId],
  );

  return result.rows[0] ?? null;
}

function buildValidationTicketPayload(voucher: TicketValidationVoucherRow) {
  return {
    purchaseId: String(voucher.idcompra),
    voucherId: String(voucher.idvoucher),
    voucherCode: normalizeVoucherCode(voucher),
    numvoucher: String(voucher.numvoucher ?? ""),
    cpf: resolveVoucherCpf(voucher.cpf, voucher),
    cellphone: String(voucher.celular ?? ""),
    type: String(voucher.tpvoucher ?? ""),
    typeLabel: resolveVoucherTypeLabel({
      description: null,
      type: voucher.tpvoucher,
    }),
    purchaseLocation: voucher.tpcompra === "ponli" ? "Online" : "Bilheteria",
    purchaseDate: String(voucher.dtcompra ?? ""),
    price: String(voucher.vlunicompra ?? ""),
    tpcompra: String(voucher.tpcompra ?? ""),
    dtAgenda: String(voucher.dtagenda ?? ""),
  };
}

async function loadConfirmedPurchase(purchaseId: number) {
  const pool = getIngressoDbPool();
  const purchase = await pool.query<ConfirmedPurchaseRow>(
    `
      SELECT
        compra.idcompra,
        compra.cpf,
        compra.tpcompra,
        compra.dtcompra::text AS dtcompra,
        usuario.email,
        usuario.nmusuario,
        usuario.celular
      FROM compra
      LEFT JOIN usuario ON usuario.cpf = compra.cpf
      WHERE compra.idcompra = $1
        AND compra.stcompra = 'conc'
      LIMIT 1
    `,
    [purchaseId],
  );

  return purchase.rows[0] ?? null;
}

async function loadPendingTicketVouchers(purchaseId: number) {
  const pool = getIngressoDbPool();
  const vouchers = await pool.query<VoucherTicketRow>(
    `
      SELECT
        voucher.idvoucher,
        voucher.numvoucher,
        voucher.tpvoucher,
        voucher.descricao,
        voucher.vlunicompra::text AS vlunicompra,
        voucher.stusado,
        voucher.voucherenviado,
        voucher.identificacao,
        voucher.idagenda,
        agenda.dtagenda::text AS dtagenda
      FROM voucher
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idcompra = $1
        AND voucher.stusado NOT IN ('s', 'inv')
        AND COALESCE(voucher.voucherenviado, 'n') <> 's'
      ORDER BY voucher.idvoucher ASC
    `,
    [purchaseId],
  );

  return vouchers.rows;
}

async function listPendingTicketDeliveryPurchases(
  recentDays: number,
  limit: number,
) {
  const pool = getIngressoDbPool();
  const result = await pool.query<PendingTicketDeliveryPurchaseRow>(
    `
      SELECT
        compra.idcompra AS purchase_id,
        COUNT(*)::text AS pending_vouchers
      FROM compra
      JOIN voucher ON voucher.idcompra = compra.idcompra
      WHERE compra.stcompra = 'conc'
        AND voucher.stusado NOT IN ('s', 'inv')
        AND COALESCE(voucher.voucherenviado, 'n') <> 's'
        AND COALESCE(compra.dtpagamento, compra.dtcompra) >= CURRENT_DATE - $1::integer
      GROUP BY compra.idcompra
      ORDER BY compra.idcompra ASC
      LIMIT $2
    `,
    [recentDays, limit],
  );

  return result.rows;
}

function toValidInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

async function loadSelectedTicketVouchers(
  purchaseId: number,
  voucherIds: number[],
) {
  if (voucherIds.length === 0) {
    return [];
  }

  const pool = getIngressoDbPool();
  const vouchers = await pool.query<VoucherTicketRow>(
    `
      SELECT
        voucher.idvoucher,
        voucher.numvoucher,
        voucher.tpvoucher,
        voucher.descricao,
        voucher.vlunicompra::text AS vlunicompra,
        voucher.stusado,
        voucher.voucherenviado,
        voucher.identificacao,
        voucher.idagenda,
        agenda.dtagenda::text AS dtagenda
      FROM voucher
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idcompra = $1
        AND voucher.idvoucher = ANY($2::int[])
        AND voucher.stusado NOT IN ('s', 'inv')
      ORDER BY voucher.idvoucher ASC
    `,
    [purchaseId, voucherIds],
  );

  return vouchers.rows;
}

async function markVouchersSent(voucherIds: number[]) {
  if (voucherIds.length === 0) {
    return;
  }

  const pool = getIngressoDbPool();

  await pool.query(
    `
      UPDATE voucher
      SET voucherenviado = 's'
      WHERE idvoucher = ANY($1::int[])
    `,
    [voucherIds],
  );
}

function buildTicketPayload(
  purchase: ConfirmedPurchaseRow,
  vouchers: VoucherTicketRow[],
) {
  const purchaseLocation =
    purchase.tpcompra === "ponli" ? "Online" : "Bilheteria";

  return vouchers.map((voucher) => ({
    purchaseId: String(purchase.idcompra),
    voucherId: String(voucher.idvoucher),
    voucherCode: normalizeVoucherCode(voucher),
    numvoucher: String(voucher.numvoucher ?? ""),
    cpf: resolveVoucherCpf(purchase.cpf, voucher),
    cellphone: String(purchase.celular ?? ""),
    type: String(voucher.tpvoucher ?? ""),
    typeLabel: resolveVoucherTypeLabel({
      description: voucher.descricao,
      type: voucher.tpvoucher,
    }),
    purchaseLocation,
    purchaseDate: String(purchase.dtcompra ?? ""),
    price: String(voucher.vlunicompra ?? ""),
    tpcompra: String(purchase.tpcompra ?? ""),
    dtAgenda: String(voucher.dtagenda ?? ""),
  }));
}

export async function processConfirmedPurchaseTickets(
  purchaseId: number,
): Promise<TicketSendResult> {
  const config = getConfig();

  if (!config) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "ticket_service_not_configured",
    };
  }

  const purchase = await loadConfirmedPurchase(purchaseId);

  if (!purchase) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "purchase_not_confirmed",
    };
  }

  const normalizedPhone = digitsOnly(purchase.celular);
  const normalizedEmail = String(purchase.email ?? "").trim();

  if (purchase.tpcompra === "ponli" && !normalizedPhone && !normalizedEmail) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "contact_missing_for_delivery",
    };
  }

  const vouchers = await loadPendingTicketVouchers(purchaseId);

  if (vouchers.length === 0) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "no_pending_vouchers",
    };
  }

  let token: string | null;

  try {
    token = await authenticate(config);
  } catch (error) {
    if (shouldSkipTicketServiceError(config, error)) {
      return {
        status: "skipped",
        purchaseId,
        sentVoucherIds: [],
        skippedReason: "ticket_service_unreachable",
      };
    }

    throw error;
  }

  if (!token) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "ticket_auth_failed",
    };
  }

  const regularVouchers = vouchers.filter((voucher) => voucher.tpvoucher !== "escol");
  const schoolVouchers = vouchers.filter((voucher) => voucher.tpvoucher === "escol");
  const sentVoucherIds: number[] = [];

  if (regularVouchers.length > 0) {
    try {
      await ticketRequest(
        config,
        "/generate-and-send-tickets",
        {
          vouchers: buildTicketPayload(purchase, regularVouchers),
          email: purchase.email,
          nmusuario: purchase.nmusuario,
        },
        token,
      );
    } catch (error) {
      if (shouldSkipTicketServiceError(config, error)) {
        return {
          status: "skipped",
          purchaseId,
          sentVoucherIds: [],
          skippedReason: "ticket_service_unreachable",
        };
      }

      throw error;
    }
    sentVoucherIds.push(...regularVouchers.map((voucher) => voucher.idvoucher));
  }

  for (const voucher of schoolVouchers) {
    try {
      await ticketRequest(
        config,
        "/send-school-ticket-message",
        {
          email: purchase.email,
          cellphone: purchase.celular,
        },
        token,
      );
    } catch (error) {
      if (shouldSkipTicketServiceError(config, error)) {
        return {
          status: "skipped",
          purchaseId,
          sentVoucherIds: [],
          skippedReason: "ticket_service_unreachable",
        };
      }

      throw error;
    }
    sentVoucherIds.push(voucher.idvoucher);
  }

  await markVouchersSent(sentVoucherIds);

  return {
    status: "sent",
    purchaseId,
    sentVoucherIds,
  };
}

export async function recoverPendingTicketDeliveries(input?: {
  recentDays?: number;
  limit?: number;
}): Promise<PendingTicketDeliveryRecoveryResult> {
  const recentDays = toValidInteger(input?.recentDays, 7, 1, 90);
  const limit = toValidInteger(input?.limit, 50, 1, 200);
  const candidates = await listPendingTicketDeliveryPurchases(recentDays, limit);
  const items: PendingTicketDeliveryRecoveryItem[] = [];
  let recovered = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const purchaseId = candidate.purchase_id;
    const pendingVouchers = Number(candidate.pending_vouchers) || 0;

    try {
      const result = await processConfirmedPurchaseTickets(purchaseId);

      await registerTicketDeliveryAudit({
        purchaseId,
        trigger: "delivery_recovery",
        result,
      }).catch((error) => {
        console.error("ticket-delivery-recovery-audit-failed", error);
      });

      if (result.status === "sent") {
        recovered += 1;
        items.push({
          purchaseId,
          pendingVouchers,
          result: "sent",
          sentVoucherIds: result.sentVoucherIds,
          note: "Entrega recuperada com sucesso.",
        });
        continue;
      }

      skipped += 1;
      items.push({
        purchaseId,
        pendingVouchers,
        result: "skipped",
        sentVoucherIds: [],
        note: `Entrega nao reenviada (${result.skippedReason ?? "skipped"}).`,
      });
    } catch (error) {
      failed += 1;
      await registerTicketDeliveryAudit({
        purchaseId,
        trigger: "delivery_recovery",
        error,
      }).catch((auditError) => {
        console.error("ticket-delivery-recovery-audit-failed", auditError);
      });
      items.push({
        purchaseId,
        pendingVouchers,
        result: "error",
        sentVoucherIds: [],
        note:
          error instanceof Error ?
            error.message :
            "Falha inesperada ao recuperar a entrega.",
      });
    }
  }

  return {
    action: "ticket_delivery_recovery",
    candidates: candidates.length,
    processed: items.length,
    recovered,
    skipped,
    failed,
    items,
    message:
      items.length > 0 ?
        `Recuperacao de entrega executada para ${items.length} compra(s).` :
        "Nenhuma compra elegivel para recuperacao de entrega.",
  };
}

export async function sendPurchaseTicketsWhatsApp(
  purchaseId: number,
  voucherIds: number[],
  phoneNumber: string,
): Promise<TicketWhatsappSendResult> {
  const normalizedPhone = digitsOnly(phoneNumber);

  if (normalizedPhone.length < 11) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "invalid_phone_number",
    };
  }

  if (!validateWhatsappPhoneForEnvironment(normalizedPhone)) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "phone_not_allowed_for_testing",
    };
  }

  const purchase = await loadConfirmedPurchase(purchaseId);

  if (!purchase) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "purchase_not_confirmed",
    };
  }

  const selectedVoucherIds = Array.from(
    new Set(
      voucherIds.filter(
        (voucherId) => Number.isInteger(voucherId) && voucherId > 0,
      ),
    ),
  );
  const vouchers = await loadSelectedTicketVouchers(purchaseId, selectedVoucherIds);

  if (vouchers.length === 0) {
    return {
      status: "skipped",
      purchaseId,
      sentVoucherIds: [],
      skippedReason: "no_selected_vouchers",
    };
  }

  await websiteTicketRequest(
    "/website/tickets/send",
    {
      phoneNumber: normalizedPhone,
      vouchers: buildTicketPayload(purchase, vouchers),
    },
  );

  return {
    status: "sent",
    purchaseId,
    sentVoucherIds: vouchers.map((voucher) => voucher.idvoucher),
  };
}

export async function syncTicketValidation(
  pairs: TicketValidationPair[],
  action: TicketValidationAction,
): Promise<TicketValidationSyncResult> {
  const normalizedPairs = Array.from(
    new Set(
      pairs
        .filter(
          (pair) =>
            Number.isInteger(pair.purchaseId) &&
            pair.purchaseId > 0 &&
            Number.isInteger(pair.voucherId) &&
            pair.voucherId > 0,
        )
        .map((pair) => `${pair.purchaseId}-${pair.voucherId}`),
    ),
  ).map((pair) => {
    const [purchaseId, voucherId] = pair.split("-").map(Number);

    return { purchaseId, voucherId };
  });

  if (normalizedPairs.length === 0) {
    return {
      status: "skipped",
      action,
      pairs: [],
      skippedReason: "no_ticket_pairs",
    };
  }

  const config = getConfig();

  if (!config) {
    return {
      status: "skipped",
      action,
      pairs: normalizedPairs.map(
        (pair) => `${pair.purchaseId}-${pair.voucherId}`,
      ),
      skippedReason: "ticket_service_not_configured",
    };
  }

  let token: string | null;

  try {
    token = await authenticate(config);
  } catch (error) {
    if (shouldSkipTicketServiceError(config, error)) {
      return {
        status: "skipped",
        action,
        pairs: normalizedPairs.map(
          (pair) => `${pair.purchaseId}-${pair.voucherId}`,
        ),
        skippedReason: "ticket_service_unreachable",
      };
    }

    throw error;
  }

  if (!token) {
    return {
      status: "skipped",
      action,
      pairs: normalizedPairs.map(
        (pair) => `${pair.purchaseId}-${pair.voucherId}`,
      ),
      skippedReason: "ticket_auth_failed",
    };
  }

  for (const pair of normalizedPairs) {
    const payload: Record<string, unknown> = {
      id: `${pair.purchaseId}-${pair.voucherId}`,
      action,
    };

    if (config.testing) {
      payload.isTesting = "true";
    }

    if (action === "validate") {
      const voucher = await loadTicketValidationVoucher(
        pair.purchaseId,
        pair.voucherId,
      );

      if (!voucher) {
        return {
          status: "skipped",
          action,
          pairs: normalizedPairs.map(
            (currentPair) => `${currentPair.purchaseId}-${currentPair.voucherId}`,
          ),
          skippedReason: "ticket_validation_payload_missing",
        };
      }

      payload.ticket = buildValidationTicketPayload(voucher);
    }

    try {
      await ticketRequest(config, "/tickets/validate", payload, token);
    } catch (error) {
      if (shouldSkipTicketServiceError(config, error)) {
        return {
          status: "skipped",
          action,
          pairs: normalizedPairs.map(
            (currentPair) => `${currentPair.purchaseId}-${currentPair.voucherId}`,
          ),
          skippedReason: "ticket_service_unreachable",
        };
      }

      throw error;
    }
  }

  return {
    status: "sent",
    action,
    pairs: normalizedPairs.map(
      (pair) => `${pair.purchaseId}-${pair.voucherId}`,
    ),
  };
}
