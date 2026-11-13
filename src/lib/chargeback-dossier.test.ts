import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CieloChargebackCase } from "@/lib/chargeback-contract";
import { collectChargebackEvidence, describeChargebackIssue, evaluateChargebackEvidence } from "@/lib/chargeback-dossier";

const { systemQuery, deliveryQuery, configured, querySale, release } = vi.hoisted(() => ({
  systemQuery: vi.fn(),
  deliveryQuery: vi.fn(),
  configured: vi.fn(),
  querySale: vi.fn(),
  release: vi.fn(),
}));
vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbPool: () => ({ connect: async () => ({ query: systemQuery, release }) }),
  getIngressoSistemaDbDialect: () => "postgres",
  getIngressoDbPool: () => ({ query: deliveryQuery }),
}));

vi.mock("@/lib/cielo-ecommerce", () => ({
  isCieloEcommerceConfigured: configured,
  getCieloSaleByPaymentId: querySale,
}));

const chargeback: CieloChargebackCase = {
  idCase: "1034",
  idChargeback: "234",
  establishmentNumber: "4234",
  treatmentDeadline: "2099-11-30",
  transactionAmount: "100.00",
  process: "PRIMEIRO_CHARGEBACK",
  transactionDetails: {
    tid: "TID-X",
    currency: "REAL",
    nsu: "0030",
    authorization: "1234",
    transactionDate: "2026-10-09",
    cardAssociationName: "Visa",
    truncatedCard: "444422******1234",
  },
  chargebackDetails: { reasonCode: "131", reasonDescription: "Serviço não prestado" },
  remoteStatus: "PENDING",
};

function payment(overrides: Record<string, unknown> = {}, id = "PAYMENT-X") {
  return {
    purchase_id: 20,
    payment_id: id,
    ledger_status: overrides.Status === 3 ? 7 : 3,
    payload: JSON.stringify({
      status: "00",
      sale: {
        MerchantOrderId: "20",
        Customer: { Name: "Compradora", Email: "compra@example.com" },
        Payment: {
          PaymentId: id,
          Tid: "TID-X",
          ProofOfSale: "30",
          AuthorizationCode: "1234",
          ReceivedDate: "2026-10-09T22:00:00",
          Amount: 10000,
          Status: 2,
          CreditCard: { CardNumber: "4444224444441234", SecurityCode: "555", Brand: "Visa" },
          ExternalAuthentication: { Eci: "05", Cavv: "segredo-autenticacao" },
          ...overrides,
        },
      },
    }),
  };
}

const usedVoucher = {
  voucher_id: 100,
  voucher_number: "V100",
  voucher_type: "Ingresso adulto",
  visit_date: "2026-10-10",
  unit_value: "100.00",
  state: "s",
  use_date: "2026-10-10",
  use_time: "09:12:34",
};

describe("chargeback evidence", () => {
  let candidates: ReturnType<typeof payment>[];
  let attempts: ReturnType<typeof payment>[];
  let vouchers: (typeof usedVoucher)[];
  let auditRows: Record<string, unknown>[];
  let accounts: Record<string, unknown>[];
  let previousPurchases: Record<string, unknown>[];
  let siteAccountsPresent: boolean;
  let purchaseDate: string | null;

  beforeEach(() => {
    configured.mockReset().mockReturnValue(false);
    querySale.mockReset();
    candidates = [payment()];
    attempts = [payment()];
    vouchers = [usedVoucher];
    auditRows = [];
    accounts = [{ source: "usuario", registered_on: "2025-03-01", last_login_date: "2026-11-12", last_login_time: "14:15:16" }];
    previousPurchases = [{ previous_purchase_count: "3", completed: "1", cancelled: "1", other: "1", first_date: "2025-04-01", last_date: "2026-10-08" }];
    siteAccountsPresent = true;
    purchaseDate = "2026-10-09";
    systemQuery.mockReset().mockImplementation(async (sql: string) => {
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
      if (sql.includes("to_regclass('usuario_site_conta')")) return { rows: [{ regclass: siteAccountsPresent ? "usuario_site_conta" : null }] };
      if (sql.includes("AS registered_on")) return { rows: accounts.filter((a) => a.source === (sql.includes("JOIN usuario_site_conta") ? "usuario_site_conta" : "usuario")) };
      if (sql.includes("AS previous_purchase_count")) return { rows: previousPurchases };
      if (sql.includes("to_regclass")) return { rows: [{ regclass: "edicoes_log" }] };
      if (sql.includes('AS payload')) {
        return { rows: sql.includes("WHERE idcompra") ? attempts : candidates };
      }
      if (sql.includes("FROM compra")) return { rows: [{
        purchase_date: purchaseDate,
        total: "100.00",
        status: "conc",
        buyer_name: "Cadastro atual",
        buyer_email: "cadastro@example.com",
      }] };
      if (sql.includes("FROM voucher v")) return { rows: vouchers };
      if (sql.includes("FROM edicoes_log")) return { rows: auditRows };
      throw new Error(sql);
    });
    deliveryQuery.mockReset().mockImplementation(async (sql: string) => {
      if (sql.includes("FROM compra")) return { rows: [{ flenvio: "sim" }] };
      if (sql.includes("FROM edicoes_log")) return { rows: [{
        id: 10,
        action: "sent",
        occurred_at: new Date("2026-10-09T22:01:02Z"),
        details: JSON.stringify({ trigger: "payment_reconciliation", sentVoucherIds: [100, 999] }),
      }] };
      throw new Error(sql);
    });
  });

  it("adds account and prior-purchase context without calling it cardholder proof", async () => {
    accounts.push({ source: "usuario_site_conta", registered_on: "2026-05-01", last_login_date: "2026-11-13", last_login_time: "10:00:00" });
    const evidence = await collectChargebackEvidence(chargeback);
    expect(evidence.customerHistory).toEqual({
      accounts: [
        { source: "usuario", registeredOn: "2025-03-01", lastLoginAt: "2026-11-12 14:15:16" },
        { source: "usuario_site_conta", registeredOn: "2026-05-01", lastLoginAt: "2026-11-13 10:00:00" },
      ],
      previousPurchases: { total: 3, completed: 1, cancelled: 1, other: 1, firstDate: "2025-04-01", lastDate: "2026-10-08" },
    });
    expect(JSON.stringify(evidence.customerHistory)).not.toMatch(/cpf|senha|ip|authenticated|uncontested|cardholder/i);
  });

  it("supports an absent site-account table and unavailable relationship records", async () => {
    siteAccountsPresent = false;
    accounts = [];
    previousPurchases = [];
    expect((await collectChargebackEvidence(chargeback)).customerHistory).toEqual({ accounts: [], previousPurchases: null });
  });

  it("distinguishes no previous purchases from unavailable history and keeps missing login unknown", async () => {
    accounts = [{ source: "usuario", registered_on: null, last_login_date: "2026-11-12", last_login_time: null }];
    previousPurchases = [{ previous_purchase_count: "0", completed: "0", cancelled: "0", other: "0", first_date: null, last_date: null }];
    const history = (await collectChargebackEvidence(chargeback)).customerHistory;
    expect(history?.accounts).toEqual([{ source: "usuario", registeredOn: "", lastLoginAt: null }]);
    expect(history?.previousPurchases).toEqual({ total: 0, completed: 0, cancelled: 0, other: 0, firstDate: "", lastDate: "" });
  });

  it("keeps previous history unavailable when purchase chronology is missing", async () => {
    purchaseDate = null;
    previousPurchases = [{ previous_purchase_count: "0", completed: "0", cancelled: "0", other: "0", first_date: null, last_date: null }];
    expect((await collectChargebackEvidence(chargeback)).customerHistory?.previousPurchases).toBeNull();
  });

  it("does not make history look successful when its query fails", async () => {
    const original = systemQuery.getMockImplementation()!;
    systemQuery.mockImplementation(async (sql: string, ...args: unknown[]) => {
      if (sql.includes("AS previous_purchase_count")) throw new Error("history_query_failed");
      return original(sql, ...args);
    });
    await expect(collectChargebackEvidence(chargeback)).rejects.toThrow("history_query_failed");
    expect(release).toHaveBeenCalled();
  });

  it("provides readable exception descriptions without echoing unknown upstream codes", () => {
    expect(describeChargebackIssue("partial_or_unproven_use")).toContain("valor integral");
    expect(describeChargebackIssue("payment_reversal")).toContain("estorno");
    expect(describeChargebackIssue("unknown_upstream_detail")).not.toContain("unknown_upstream_detail");
    expect(describeChargebackIssue("toString")).toBe("A verificação encontrou uma inconsistência sem descrição cadastrada.");
  });

  it.each([
    [0, undefined, "0", false],
    ["7", undefined, "7", false],
    [undefined, "05", "05", false],
    [5, "05", "05", false],
    ["7", "05", "", true],
    ["invalid", "bad", "", false],
    [undefined, undefined, "", false],
  ])("preserves ECI sources (root %s, nested %s)", async (root, nested, expected, conflict) => {
    candidates = [payment({ Eci: root, ExternalAuthentication: { Eci: nested } })];
    attempts = candidates;
    const evidence = await collectChargebackEvidence(chargeback);
    expect(evidence.paymentAttempts[0]).toMatchObject({
      eci: expected,
      eciSources: { conflict },
    });
    if (root === 0) expect(evidence.paymentAttempts[0]).toMatchObject({ eciSources: { payment: "0" } });
    if (conflict) expect(evidence.paymentAttempts[0]).toMatchObject({ eciSources: { payment: "7", externalAuthentication: "05" } });
  });

  it("keeps transaction declarations separate from current registration and masks identity", async () => {
    const row = payment({ CreditCard: { Holder: "Titular Declarado", Brand: "Visa", CardNumber: "4444224444441234", SecurityCode: "555" } });
    const payload = JSON.parse(row.payload);
    payload.sale.Customer.Identity = "123.456.789-01";
    row.payload = JSON.stringify(payload);
    candidates = [row];
    attempts = candidates;
    const evidence = await collectChargebackEvidence(chargeback);
    expect(evidence.paymentAttempts[0]).toMatchObject({
      holderName: "Titular Declarado",
      buyerName: "Compradora",
      buyerDocumentMasked: "***.***.***-01",
      authentication: { cavvPresent: true, referencePresent: false, version: "", requested: null, dataOnly: null },
    });
    expect(evidence.purchase?.buyerName).toBe("Cadastro atual");
    expect(JSON.stringify(evidence)).not.toMatch(/123\.456\.789-01|12345678901|4444224444441234|SecurityCode|segredo-autenticacao/);
  });

  it("handles absent and malformed declarations without copying arbitrary content", async () => {
    const row = payment({ CreditCard: { Holder: "4444224444441234" }, ExternalAuthentication: { Version: "secret-not-version", ReferenceId: "private-reference", Cavv: "private-cavv", DataOnly: true }, Authenticate: false });
    const payload = JSON.parse(row.payload);
    payload.sale.Customer.Identity = "foreign-document-secret";
    row.payload = JSON.stringify(payload);
    candidates = [row]; attempts = candidates;
    const evidence = await collectChargebackEvidence(chargeback);
    expect(evidence.paymentAttempts[0]).toMatchObject({ holderName: "", buyerDocumentMasked: "", authentication: { version: "", cavvPresent: true, referencePresent: true, requested: false, dataOnly: true } });
    expect(JSON.stringify(evidence)).not.toMatch(/4444224444441234|foreign-document-secret|private-reference|private-cavv|secret-not-version/);
  });

  it.each([["Visa", "104"], ["Mastercard", "4837"], ["Elo", "83"]])("keeps fraud blocked for %s %s with declarations and used tickets", async (brand, reasonCode) => {
    candidates = [payment({ EstablishmentNumber: "4234", Eci: "05", Authenticate: true, CreditCard: { Holder: "Titular Declarado", Brand: brand } })];
    attempts = candidates;
    const evidence = await collectChargebackEvidence({ ...chargeback, transactionDetails: { ...chargeback.transactionDetails, cardAssociationName: brand }, chargebackDetails: { reasonCode, reasonDescription: "Fraude" } });
    expect(evidence.paymentAttempts[0]).toMatchObject({ holderName: "Titular Declarado" });
    expect(evaluateChargebackEvidence(evidence)).toMatchObject({ eligible: false, issues: expect.arrayContaining(["unsupported_reason"]) });
  });

  it("uses the exact TID, includes failed attempts and delivery, and excludes raw card/authentication secrets", async () => {
    attempts.push(payment({ Tid: "OTHER", Status: 3 }, "DENIED"));
    const evidence = await collectChargebackEvidence(chargeback);
    expect(evidence.purchaseId).toBe(20);
    expect(evidence.paymentId).toBe("PAYMENT-X");
    expect(evidence.link).toEqual({ method: "tid", establishmentVerified: false });
    expect(evidence.paymentAttempts).toHaveLength(2);
    expect(evidence.paymentAttempts[1]).toEqual({ status: "3", ledgerStatus: "7", amountCents: 10000 });
    expect(JSON.stringify(evidence)).not.toMatch(/OTHER|DENIED/);
    expect(evidence.deliveryEvents[0]).toMatchObject({
      occurredAt: "2026-10-09T22:01:02.000Z",
      voucherIds: [100],
    });
    expect(evidence.emailQueued).toBe(true);
    expect(JSON.stringify(evidence)).not.toMatch(/4444224444441234|SecurityCode|segredo-autenticacao|999/);
    expect(evaluateChargebackEvidence(evidence).issues).toContain("establishment_unverified");
    expect(systemQuery).toHaveBeenCalledWith("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(systemQuery).toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalled();

    configured.mockReturnValue(true);
    querySale.mockResolvedValue(JSON.parse(payment().payload).sale);
    expect(evaluateChargebackEvidence(await collectChargebackEvidence(chargeback))).toMatchObject({ eligible: true });
  });

  it.each([
    ["Visa", "131", "REAL", "PRIMEIRO_CHARGEBACK"],
    ["Visa", "13.1", "BRL", "1"],
    ["Mastercard", "4855", "986", "1"],
    ["Master", "4859", "REAL", "PRIMEIRO_CHARGEBACK"],
  ])("allows documented service reason %s %s in %s at stage %s", async (brand, reasonCode, currency, process) => {
    candidates = [payment({ EstablishmentNumber: "4234" })];
    attempts = [...candidates];
    const evidence = await collectChargebackEvidence({
      ...chargeback,
      process,
      transactionDetails: { ...chargeback.transactionDetails, cardAssociationName: brand, currency },
      chargebackDetails: { ...chargeback.chargebackDetails, reasonCode },
    });
    expect(evidence.case.process).toBe(process);
    expect(evidence.case.transactionDetails.currency).toBe(currency);
    expect(evaluateChargebackEvidence(evidence).eligible).toBe(true);
  });

  it.each([
    ["PRE_ARBITRAGEM", "REAL", "unsupported_process"],
    [undefined, "REAL", "unsupported_process"],
    ["PRIMEIRO_CHARGEBACK", "USD", "unsupported_currency"],
    ["PRIMEIRO_CHARGEBACK", undefined, "unsupported_currency"],
  ])("blocks automated defense for process %s or currency %s", async (process, currency, issue) => {
    candidates = [payment({ EstablishmentNumber: "4234" })];
    attempts = [...candidates];
    const evidence = await collectChargebackEvidence({
      ...chargeback,
      process,
      transactionDetails: { ...chargeback.transactionDetails, currency },
    });
    expect(evaluateChargebackEvidence(evidence).issues).toContain(issue);
  });

  it("rejects ambiguous TIDs and known establishment conflicts", async () => {
    candidates.push(payment({}, "DUPLICATE"));
    expect((await collectChargebackEvidence(chargeback)).issues).toContain("ambiguous_transaction");
    candidates = [payment({ EstablishmentNumber: "OTHER" })];
    expect((await collectChargebackEvidence(chargeback)).issues).toContain("transaction_conflict");
  });

  it("uses NSU, authorization and date only with verified establishment and no conflicting TID", async () => {
    candidates = [payment({ Tid: "", EstablishmentNumber: "4234" })];
    attempts = [...candidates];
    const evidence = await collectChargebackEvidence(chargeback);
    expect(evidence.link).toEqual({ method: "nsu_authorization_date", establishmentVerified: true });
    candidates = [payment({ Tid: "" })];
    expect((await collectChargebackEvidence(chargeback)).paymentId).toBeNull();
    candidates = [payment({ Tid: "OTHER", EstablishmentNumber: "4234" })];
    expect((await collectChargebackEvidence(chargeback)).paymentId).toBeNull();
  });

  it("rejects a TID conflict found by the live query after an NSU fallback", async () => {
    candidates = [payment({ Tid: "", EstablishmentNumber: "4234" })];
    attempts = [...candidates];
    configured.mockReturnValue(true);
    querySale.mockResolvedValue(JSON.parse(payment({ Tid: "OTHER", EstablishmentNumber: "4234" }).payload).sale);
    const evidence = await collectChargebackEvidence(chargeback);
    expect(evidence.issues).toContain("live_transaction_conflict");
    expect(evaluateChargebackEvidence(evidence).eligible).toBe(false);
  });

  it("detects a portal cancellation and a newer partial refund returned by Cielo", async () => {
    const cancelled = { ...payment(), cancellation_source: "portal" };
    candidates = [cancelled];
    attempts = [cancelled];
    expect(evaluateChargebackEvidence(await collectChargebackEvidence(chargeback)).issues).toContain("payment_reversal");

    candidates = [payment()];
    attempts = [payment()];
    configured.mockReturnValue(true);
    querySale.mockResolvedValue(JSON.parse(payment({ VoidedAmount: 2500 }).payload).sale);
    const evidence = await collectChargebackEvidence(chargeback);
    expect(querySale).toHaveBeenCalledWith("PAYMENT-X");
    expect(evidence.livePayment).toMatchObject({ reversedCents: 2500, reversalRecorded: true });
    expect(evaluateChargebackEvidence(evidence).issues).toContain("payment_reversal");
  });

  it("retains the full scoped timeline and separates invalidation from actual use", async () => {
    vouchers = [
      { ...usedVoucher, unit_value: "50.00" },
      { ...usedVoucher, voucher_id: 101, voucher_number: "V101", unit_value: "50.00", state: "inv" },
    ];
    auditRows = ["validar", "desvalidar", "invalidar"].map((action, index) => ({
      id: index + 1,
      purchase_id: null,
      action,
      occurred_at: new Date(`2026-10-10T1${index}:00:00Z`),
      actor_name: "Operadora (11122233344)",
      details: JSON.stringify({
        purchaseIds: [20, 999],
        affectedVoucherIds: [101, 999],
        affectedVoucherNumbers: ["V101", "V999"],
        mode: "school_trip",
      }),
    }));
    const evidence = await collectChargebackEvidence(chargeback);
    expect(evidence.voucherEvents.map((event) => [event.action, event.voucherIds, event.actor])).toEqual([
      ["validar", [101], "Operadora"],
      ["desvalidar", [101], "Operadora"],
      ["invalidar", [101], "Operadora"],
    ]);
    expect(evidence.vouchers.map((voucher) => [voucher.state, voucher.usedAt])).toEqual([
      ["used", "2026-10-10 09:12:34"],
      ["invalidated", null],
    ]);
    expect(JSON.stringify(evidence)).not.toMatch(/999|11122233344/);
    expect(evaluateChargebackEvidence(evidence).issues).toContain("partial_or_unproven_use");
  });

  it("records malformed linked audit data and rejects evidence for refunds, duplicates and unsupported reasons", async () => {
    candidates = [payment({ VoidedAmount: 50 })];
    attempts = [candidates[0], payment({ Tid: "SECOND" }, "SECOND")];
    auditRows = [{ id: 1, purchase_id: 20, action: "validar", details: "invalid" }];
    const evidence = await collectChargebackEvidence({
      ...chargeback,
      chargebackDetails: { reasonCode: "104", reasonDescription: "Fraude" },
    });
    expect(evaluateChargebackEvidence(evidence).issues).toEqual(expect.arrayContaining([
      "voucher_audit_incomplete", "payment_reversal", "duplicate_capture", "unsupported_reason",
    ]));
  });
});
