import {
  normalizePaymentReconciliationPayload,
  type PaymentReconciliationRecord,
} from "@/lib/payment-reconciliation";

const defaultApiEndpoint = "https://api.cieloecommerce.cielo.com.br/";
const defaultQueryEndpoint = "https://apiquery.cieloecommerce.cielo.com.br/";

type CieloEcommerceConfig = {
  merchantId: string;
  merchantKey: string;
  apiEndpoint: string;
  queryEndpoint: string;
  timeoutMs: number;
};

type CieloCheckoutStatusQuery = {
  paymentId?: string | null;
  reference?: string | null;
  purchaseId: number;
};

type NativeCheckoutCustomer = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
};

type NativeCheckoutRequest = {
  purchaseId: number;
  amount: string | number;
  customer: NativeCheckoutCustomer;
  payment: Record<string, unknown>;
  returnUrl?: string | null;
};

function normalizeEndpoint(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function getConfig(): CieloEcommerceConfig | null {
  const merchantId = process.env.INGRESSO_CIELO_MERCHANT_ID?.trim() ?? "";
  const merchantKey = process.env.INGRESSO_CIELO_MERCHANT_KEY?.trim() ?? "";

  if (!merchantId || !merchantKey) {
    return null;
  }

  return {
    merchantId,
    merchantKey,
    apiEndpoint: normalizeEndpoint(
      process.env.INGRESSO_CIELO_API_ENDPOINT?.trim() || defaultApiEndpoint,
    ),
    queryEndpoint: normalizeEndpoint(
      process.env.INGRESSO_CIELO_QUERY_ENDPOINT?.trim() ||
        defaultQueryEndpoint,
    ),
    timeoutMs: Number(process.env.INGRESSO_CIELO_TIMEOUT_MS ?? 30000),
  };
}

export function isCieloEcommerceConfigured() {
  return getConfig() !== null;
}

async function cieloRequest(
  method: "GET" | "POST" | "PUT",
  path: string,
  payload: unknown = null,
  endpoint: "api" | "query" = "query",
) {
  const config = getConfig();

  if (!config) {
    throw new Error("cielo_ecommerce_not_configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const baseUrl = endpoint === "api" ? config.apiEndpoint : config.queryEndpoint;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      MerchantId: config.merchantId,
      MerchantKey: config.merchantKey,
    },
    body: payload === null ? undefined : JSON.stringify(payload),
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  const responsePayload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof responsePayload === "object" && responsePayload !== null
        ? JSON.stringify(responsePayload)
        : "Cielo API error";

    throw new Error(`cielo_ecommerce_error_${response.status}: ${message}`);
  }

  return responsePayload;
}

export async function getCieloSaleByPaymentId(paymentId: string) {
  const normalizedPaymentId = paymentId.trim();

  if (!normalizedPaymentId) {
    throw new Error("cielo_payment_id_invalid");
  }

  return cieloRequest(
    "GET",
    `1/sales/${encodeURIComponent(normalizedPaymentId)}`,
  );
}

export async function getCieloSaleByMerchantOrderId(merchantOrderId: string) {
  const normalizedMerchantOrderId = merchantOrderId.trim();

  if (!normalizedMerchantOrderId) {
    throw new Error("cielo_merchant_order_id_invalid");
  }

  return cieloRequest(
    "GET",
    `1/sales?merchantOrderId=${encodeURIComponent(normalizedMerchantOrderId)}`,
  );
}

export async function createCieloSale(payload: unknown) {
  return cieloRequest("POST", "1/sales/", payload, "api");
}

export async function cancelCieloPayment(paymentId: string) {
  const normalizedPaymentId = paymentId.trim();

  if (!normalizedPaymentId) {
    throw new Error("cielo_payment_id_invalid");
  }

  return cieloRequest(
    "PUT",
    `1/sales/${encodeURIComponent(normalizedPaymentId)}/void`,
    null,
    "api",
  );
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getString(object: Record<string, unknown> | null, keys: string[]) {
  if (!object) {
    return "";
  }

  for (const key of keys) {
    const value = object[key];

    if (value !== null && value !== undefined) {
      return String(value).trim();
    }
  }

  return "";
}

function getRaw(object: Record<string, unknown> | null, keys: string[]) {
  if (!object) {
    return undefined;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      return object[key];
    }
  }

  return undefined;
}

function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

function normalizeMoneyToCents(value: string | number) {
  const normalized =
    typeof value === "number"
      ? value
      : String(value).includes(",")
        ? Number(String(value).replace(/\./g, "").replace(",", "."))
        : Number(value);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("checkout_amount_invalid");
  }

  return Math.round(normalized * 100);
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return ["1", "true", "s", "sim", "yes", "on"].includes(
    String(value).trim().toLowerCase(),
  );
}

function normalizePaymentType(type: unknown) {
  switch (String(type ?? "CreditCard").trim().toLowerCase()) {
    case "debitcard":
    case "debit_card":
    case "debit":
      return "DebitCard";
    case "pix":
      return "Pix";
    case "boleto":
    case "bankslip":
      return "Boleto";
    case "credit":
    case "creditcard":
    case "credit_card":
    default:
      return "CreditCard";
  }
}

function normalizeBrand(value: unknown) {
  const brand = String(value ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    amex: "Amex",
    americanexpress: "Amex",
    aura: "Aura",
    cabal: "Cabal",
    diners: "Diners",
    discover: "Discover",
    elo: "Elo",
    hipercard: "Hipercard",
    jcb: "JCB",
    master: "Master",
    mastercard: "Master",
    visa: "Visa",
  };

  return map[brand] ?? "";
}

function normalizeExpirationDate(card: Record<string, unknown> | null) {
  const expirationDate = digitsOnly(
    getString(card, ["expirationDate", "ExpirationDate"]),
  );

  if (expirationDate.length >= 4) {
    const month = expirationDate.slice(0, 2);
    const year = expirationDate.slice(2);

    return `${month}/${year.length === 2 ? year : year.slice(-2)}`;
  }

  const month = digitsOnly(getString(card, ["expirationMonth", "ExpirationMonth"]));
  const year = digitsOnly(getString(card, ["expirationYear", "ExpirationYear"]));

  if (!month || !year) {
    return "";
  }

  return `${month.padStart(2, "0")}/${year.length === 2 ? year : year.slice(-2)}`;
}

function normalizeSoftDescriptor(value: unknown) {
  const configured =
    String(value ?? "").trim() ||
    process.env.INGRESSO_CIELO_SOFT_DESCRIPTOR?.trim() ||
    "ESTANCIA";
  const normalized = configured
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .trim();

  return (normalized || "ESTANCIA").slice(0, 13);
}

function normalizeCardData(card: Record<string, unknown> | null) {
  const cardNumber = digitsOnly(getString(card, ["cardNumber", "CardNumber", "numero"]));
  const holder = getString(card, ["holder", "Holder", "titular"]);
  const securityCode = digitsOnly(
    getString(card, ["securityCode", "SecurityCode", "cvv", "cvc"]),
  );
  const brand = normalizeBrand(getRaw(card, ["brand", "Brand", "bandeira"]));
  const expirationDate = normalizeExpirationDate(card);

  if (!cardNumber || !holder || !securityCode || !brand || !expirationDate) {
    throw new Error("checkout_card_invalid");
  }

  return {
    CardNumber: cardNumber,
    Holder: holder.slice(0, 50),
    ExpirationDate: expirationDate,
    SecurityCode: securityCode,
    Brand: brand,
  };
}

function normalizeExternalAuthentication(value: unknown) {
  const data = readObject(value);

  if (!data) {
    return null;
  }

  const normalized: Record<string, unknown> = {};
  const aliases: Record<string, string[]> = {
    Eci: ["Eci", "eci"],
    Cavv: ["Cavv", "cavv"],
    Xid: ["Xid", "xid"],
    Version: ["Version", "version"],
    ReferenceId: ["ReferenceId", "referenceId", "ReferenceID", "referenceID"],
  };

  Object.entries(aliases).forEach(([key, keys]) => {
    const value = getString(data, keys);

    if (value) {
      normalized[key] = value;
    }
  });

  const dataOnly = getRaw(data, ["DataOnly", "dataOnly"]);

  if (dataOnly !== undefined) {
    normalized.DataOnly = normalizeBoolean(dataOnly, false);
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function buildCustomer(customer: NativeCheckoutCustomer) {
  const name = String(customer.name ?? "").trim();
  const email = String(customer.email ?? "").trim();
  const phone = digitsOnly(String(customer.phone ?? ""));
  const document = digitsOnly(String(customer.document ?? ""));
  const cieloCustomer: Record<string, string> = {};

  if (name) {
    cieloCustomer.Name = name.slice(0, 60);
  }

  if (email) {
    cieloCustomer.Email = email.slice(0, 60);
  }

  if (phone) {
    cieloCustomer.Mobile = phone;
    cieloCustomer.Phone = phone;
  }

  if (document) {
    cieloCustomer.Identity = document.slice(0, 18);
    cieloCustomer.IdentityType = document.length > 11 ? "CNPJ" : "CPF";
  }

  if (!cieloCustomer.Name) {
    cieloCustomer.Name = "Cliente Estancia";
  }

  return cieloCustomer;
}

function normalizeInstallments(value: unknown, amountCents: number) {
  const maxInstallments = Math.min(
    Math.max(Number(process.env.INGRESSO_CIELO_MAX_INSTALLMENTS ?? 12), 1),
    12,
  );
  const minInstallmentValue = Math.max(
    Number(process.env.INGRESSO_CIELO_MIN_INSTALLMENT_VALUE_CENTS ?? 100),
    1,
  );
  const requested = Math.max(Number(value ?? 1), 1);
  const byValue = Math.max(Math.floor(amountCents / minInstallmentValue), 1);

  return Math.min(requested, maxInstallments, byValue);
}

function buildPayment(
  amountCents: number,
  paymentData: Record<string, unknown>,
  returnUrl?: string | null,
) {
  const type = normalizePaymentType(getRaw(paymentData, ["type", "Type"]));
  const payment: Record<string, unknown> = {
    Type: type,
    Amount: amountCents,
    SoftDescriptor: normalizeSoftDescriptor(
      getRaw(paymentData, ["softDescriptor", "SoftDescriptor"]),
    ),
  };

  if (type === "CreditCard") {
    payment.Installments = normalizeInstallments(
      getRaw(paymentData, ["installments", "Installments"]),
      amountCents,
    );
    payment.Capture = normalizeBoolean(getRaw(paymentData, ["capture", "Capture"]), true);
    payment.Authenticate = normalizeBoolean(
      getRaw(paymentData, ["authenticate", "Authenticate"]),
      false,
    );
    payment.CreditCard = normalizeCardData(
      readObject(getRaw(paymentData, ["creditCard", "CreditCard"])) ??
        paymentData,
    );
  } else if (type === "DebitCard") {
    const externalAuthentication = normalizeExternalAuthentication(
      getRaw(paymentData, ["externalAuthentication", "ExternalAuthentication"]),
    );

    if (!externalAuthentication) {
      throw new Error("checkout_debit_3ds_required");
    }

    payment.Installments = 1;
    payment.Capture = true;
    payment.Authenticate = true;
    payment.ReturnUrl = returnUrl;
    payment.DebitCard = normalizeCardData(
      readObject(getRaw(paymentData, ["debitCard", "DebitCard"])) ??
        paymentData,
    );
    payment.ExternalAuthentication = externalAuthentication;
  } else if (type === "Pix") {
    payment.Provider = "Cielo2";
    payment.QrCode = {
      Expiration: Math.max(
        Number(process.env.INGRESSO_CIELO_PIX_EXPIRATION_SECONDS ?? 86400),
        1,
      ),
    };
  }

  if (type !== "Pix") {
    const provider = getString(paymentData, ["Provider", "provider"]);

    if (provider) {
      payment.Provider = provider;
    }
  }

  if (returnUrl && !payment.ReturnUrl && type !== "Pix") {
    payment.ReturnUrl = returnUrl;
  }

  return payment;
}

function buildCieloSalePayload({
  purchaseId,
  amount,
  customer,
  payment,
  returnUrl,
}: NativeCheckoutRequest) {
  const amountCents = normalizeMoneyToCents(amount);

  return {
    MerchantOrderId: String(purchaseId).replace(/[^A-Za-z0-9]/g, "").slice(0, 20),
    Customer: buildCustomer(customer),
    Payment: buildPayment(amountCents, payment, returnUrl),
  };
}

function isSaleShape(value: unknown) {
  const object = readObject(value);

  return Boolean(
    object?.Payment ||
      object?.payment ||
      object?.MerchantOrderId ||
      object?.merchantOrderId ||
      object?.OrderNumber ||
      object?.orderNumber,
  );
}

function extractPaymentIds(value: unknown) {
  const object = readObject(value);
  const payments = readArray(object?.Payments ?? object?.payments);

  return payments
    .map((payment) =>
      getString(readObject(payment), ["PaymentId", "paymentId", "Id", "id"]),
    )
    .filter(Boolean);
}

async function getSalesByReference(reference: string) {
  const result = await getCieloSaleByMerchantOrderId(reference);
  const paymentIds = extractPaymentIds(result);

  if (paymentIds.length > 0) {
    const sales = await Promise.all(
      paymentIds.map(async (paymentId) => {
        const sale = await getCieloSaleByPaymentId(paymentId);
        const saleObject = readObject(sale);

        return saleObject
          ? {
              ...saleObject,
              MerchantOrderId: reference,
            }
          : sale;
      }),
    );

    return sales;
  }

  if (isSaleShape(result)) {
    return [result];
  }

  return readArray(result).filter(isSaleShape);
}

function recordToLegacyGatewayPayload(record: PaymentReconciliationRecord) {
  return {
    code: record.gatewayPaymentId,
    reference: record.reference,
    status: record.status,
    cancellationSource: "",
    date: record.date.toISOString(),
    lastEventDate: record.lastEventDate.toISOString(),
    paymentMethod: {
      type: record.paymentMethodType,
      code: record.paymentMethodCode,
    },
    grossAmount: record.grossAmount,
    discountAmount: record.discountAmount,
    feeAmount: record.feeAmount,
    netAmount: record.netAmount,
    extraAmount: record.extraAmount,
    installmentCount: record.installmentCount,
    sender: {
      email: record.senderEmail,
      name: record.senderName,
      phone: {
        areaCode: record.senderPhoneAreaCode,
        number: record.senderPhoneNumber,
      },
    },
    shipping: {
      type: record.shippingType,
      cost: record.shippingCost,
      address: {
        street: record.shippingAddressStreet,
        number: record.shippingAddressNumber,
        district: record.shippingAddressDistrict,
        city: record.shippingAddressCity,
        state: record.shippingAddressState,
        country: record.shippingAddressCountry,
        postalCode: record.shippingAddressPostalCode,
        complement: [""],
      },
    },
    xml: record.xml,
  };
}

export async function getNativeCieloCheckoutStatus({
  paymentId,
  reference,
  purchaseId,
}: CieloCheckoutStatusQuery) {
  const sales = paymentId
    ? [await getCieloSaleByPaymentId(paymentId)]
    : reference
      ? await getSalesByReference(reference)
      : [];

  if (sales.length === 0) {
    return {
      status: "30",
      msgRetorno: "Transacao nao encontrada.",
    };
  }

  const normalized = sales
    .map((sale) =>
      normalizePaymentReconciliationPayload(sale, purchaseId),
    )
    .sort((a, b) => b.lastEventDate.getTime() - a.lastEventDate.getTime())
    .map(recordToLegacyGatewayPayload);

  return {
    status: "00",
    dados: normalized.length === 1 ? normalized[0] : normalized,
    sale: sales.length === 1 ? sales[0] : null,
  };
}

export async function createNativeCieloCheckout(request: NativeCheckoutRequest) {
  const salePayload = buildCieloSalePayload(request);
  const sale = await createCieloSale(salePayload);
  const record = normalizePaymentReconciliationPayload(sale, request.purchaseId);

  return {
    status: "00",
    paymentId: record.gatewayPaymentId,
    dados: recordToLegacyGatewayPayload(record),
    sale,
  };
}
