import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CieloChargebackCase } from "@/lib/chargeback-contract";
import type { ChargebackEvidence } from "@/lib/chargeback-dossier";
import {
  getChargebackDossier,
  recordChargebackNotification,
  saveChargebackDossier,
  upsertChargeback,
  withChargebackWorkerLock,
} from "@/lib/chargeback-repository";
import { runChargebackSync } from "@/lib/chargeback-sync";

const mocks = vi.hoisted(() => ({
  pool: null as Pool | null,
  collect: vi.fn(),
  list: vi.fn(),
  page: vi.fn(),
  submit: vi.fn(),
  lifecycle: vi.fn(),
  document: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbPool: () => mocks.pool,
  getIngressoSistemaDbDialect: () => "postgres",
}));
vi.mock("@/lib/cielo-chargeback", async (original) => ({
  ...await original<typeof import("@/lib/cielo-chargeback")>(),
  listCieloChargebacks: mocks.list,
  listCieloChargebackPage: mocks.page,
  submitCieloChargebackDefense: mocks.submit,
  getCieloChargebackLifecycle: mocks.lifecycle,
  getCieloChargebackDocument: mocks.document,
  isCieloChargebackConfigured: () => true,
}));
vi.mock("@/lib/chargeback-dossier", async (original) => ({
  ...await original<typeof import("@/lib/chargeback-dossier")>(),
  collectChargebackEvidence: mocks.collect,
}));
vi.mock("@/lib/legacy-email", () => ({ queueLegacyEmail: mocks.email }));

// Opt in with a dedicated scratch database on loopback. The suite owns a random schema.
const connectionString = process.env.CHARGEBACK_TEST_DATABASE_URL;
if (connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" ||
    !/^\/chargeback_test[A-Za-z0-9_]*$/.test(url.pathname) || url.search || url.hash) {
    throw new Error("CHARGEBACK_TEST_DATABASE_URL must target a scratch chargeback_test database on 127.0.0.1 without URL options");
  }
}

const receptionDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const pending: CieloChargebackCase = {
  idCase: "12345678901234567890",
  idChargeback: "23456789012345678901",
  establishmentNumber: "1024162076",
  treatmentDeadline: "2099-12-31",
  transactionAmount: "100.00",
  process: "PRIMEIRO_CHARGEBACK",
  transactionDetails: {
    tid: "TEST-TID",
    nsu: "300",
    authorization: "4444",
    transactionDate: "2024-06-01",
    truncatedCard: "**** 1234",
    cardAssociationName: "Visa",
    currency: "REAL",
  },
  chargebackDetails: { reasonCode: "13.1", reasonDescription: "Serviço não recebido", receptionDate },
  remoteStatus: "PENDING",
};

function collectedEvidence(chargeback: CieloChargebackCase): ChargebackEvidence {
  return {
    case: chargeback,
    purchaseId: 25,
    paymentId: "TEST-PAYMENT",
    capturedAt: "2024-06-03T10:00:00Z",
    issues: [],
    link: { method: "tid", establishmentVerified: true },
    purchase: { date: "2024-06-01", totalCents: 10000, status: "conc", buyerName: "", buyerEmail: "" },
    paymentAttempts: [{
      id: "TEST-PAYMENT", tid: "TEST-TID", nsu: "300", authorization: "4444", establishment: "1024162076",
      receivedAt: "2024-06-01T10:00:00", capturedAt: "2024-06-01T10:00:00", status: "2", ledgerStatus: "3",
      amountCents: 10000, reversedCents: null, reversalRecorded: false, installments: 1, brand: "Visa",
      lastFour: "1234", eci: "", buyerName: "", buyerEmail: "", merchantOrderId: "25",
    }],
    livePayment: null,
    livePaymentCheckedAt: null,
    vouchers: [{
      id: 33, number: "TEST-VOUCHER", category: "Ingresso adulto", visitDate: "2024-06-02", unitCents: 10000,
      state: "used", usedAt: "2024-06-02 09:10:00", invalidatedAt: null,
    }],
    voucherEvents: [{
      id: 44, action: "validar", occurredAt: "2024-06-02T12:10:00Z", voucherIds: [33], mode: "voucher_number", actor: "Operadora",
    }],
    deliveryEvents: [],
    emailQueued: null,
    communicationsCapturedAt: null,
  };
}

describe.skipIf(!connectionString)("chargeback pipeline with PostgreSQL", () => {
  const schema = `chargeback_it_${randomBytes(8).toString("hex")}`;
  const unrelatedSchema = `${schema}_unrelated`;
  let admin: Pool;
  let pool: Pool;
  let migration: string;
  let remote: CieloChargebackCase;
  let remoteFile: string;

  beforeAll(async () => {
    admin = new Pool({ connectionString, connectionTimeoutMillis: 2_000 });
    await admin.query(`
      CREATE SCHEMA ${schema};
      CREATE SCHEMA ${unrelatedSchema};
      CREATE TABLE ${unrelatedSchema}.cases (
        id INTEGER CONSTRAINT chargeback_submitted_dossier_case_fk CHECK (id > 0)
      )
    `);
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2_000 });
    mocks.pool = pool;
    migration = await readFile(new URL("../../docs/sql/2026-11-03-chargeback-dossiers.sql", import.meta.url), "utf8");
    await pool.query(migration);
    await pool.query("CREATE TABLE compra (dtcompra DATE NOT NULL)");
  });

  afterAll(async () => {
    await pool?.end();
    if (admin) {
      try {
        await admin.query(`DROP SCHEMA IF EXISTS ${schema}, ${unrelatedSchema} CASCADE`);
      } finally {
        await admin.end();
      }
    }
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE chargeback_reconciliation, chargeback_events, chargeback_cases, chargeback_dossiers RESTART IDENTITY");
    vi.resetAllMocks();
    vi.stubEnv("CIELO_CHARGEBACK_ALERT_EMAIL", "chargeback-test@example.invalid");
    vi.stubEnv("CIELO_CHARGEBACK_START_DATE", receptionDate);
    remote = pending;
    remoteFile = "";
    mocks.list.mockImplementation(async (status: string, options: { idCase?: string } = {}) => {
      return status === remote.remoteStatus && (!options.idCase || options.idCase === remote.idCase) ? [remote] : [];
    });
    mocks.page.mockResolvedValue({ items: [], last: true });
    mocks.collect.mockImplementation(async (chargeback: CieloChargebackCase) => collectedEvidence(chargeback));
    mocks.submit.mockImplementation(async (_chargeback: CieloChargebackCase, pdf: Buffer) => {
      remoteFile = pdf.toString("base64");
      return { code: "102", message: "Defesa recebida" };
    });
    mocks.document.mockImplementation(async () => remoteFile ? { file: remoteFile } : null);
    mocks.lifecycle.mockResolvedValue([{ action: "A favor do Estabelecimento", actionDate: receptionDate }]);
    mocks.email.mockResolvedValue(1);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("imports a webhook, archives and submits once, and updates the outcome on another tick", async () => {
    const notification = {
      kind: "new_case",
      idCase: pending.idCase,
      establishmentNumber: pending.establishmentNumber,
      fingerprint: "same-webhook",
    };
    await recordChargebackNotification(notification);
    await recordChargebackNotification(notification);
    mocks.page.mockResolvedValueOnce({ items: [], last: false });

    expect(await runChargebackSync()).toMatchObject({ imported: 1, processed: 0, failed: 0 });
    expect(mocks.page).toHaveBeenCalledOnce();
    expect(mocks.page).toHaveBeenNthCalledWith(1, "PENDING", expect.objectContaining({ page: 0 }));
    expect(await runChargebackSync()).toMatchObject({ processed: 1, failed: 0 });
    expect(mocks.page).toHaveBeenNthCalledWith(2, "PENDING", expect.objectContaining({ page: 1 }));
    expect(mocks.collect).toHaveBeenCalled();
    const collectionsBeforeReconciliation = mocks.collect.mock.calls.length;
    const result = await pool.query("SELECT id, status, receipt, submitted_dossier_id FROM chargeback_cases");
    expect(result.rows).toEqual([expect.objectContaining({
      status: "submitted",
      receipt: { code: "102", message: "Defesa recebida" },
      submitted_dossier_id: expect.any(Number),
    })]);
    const dossier = await getChargebackDossier(result.rows[0].id);
    expect(dossier?.filename).toBe(`${pending.idCase}.pdf`);
    expect(dossier?.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(dossier?.pdf).toEqual(Buffer.from(remoteFile, "base64"));
    expect(dossier?.sha256).toBe(createHash("sha256").update(Buffer.from(remoteFile, "base64")).digest("hex"));
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM chargeback_events WHERE kind='new_case' AND processed_at IS NOT NULL")).rows[0].count).toBe(1);
    expect(await runChargebackSync()).toMatchObject({ processed: 0, failed: 0 });

    remote = { ...pending, remoteStatus: "DONE", actionTakenCode: "RECUSADO" };
    await pool.query("UPDATE chargeback_cases SET next_attempt_at=NOW()");
    expect(await runChargebackSync()).toMatchObject({ processed: 1, failed: 0 });
    expect((await pool.query("SELECT status, result_message FROM chargeback_cases")).rows[0]).toMatchObject({
      status: "resolved",
      result_message: "A favor do Estabelecimento",
    });
    await pool.query("UPDATE chargeback_cases SET next_attempt_at=NOW()");
    expect(await runChargebackSync()).toMatchObject({ processed: 0 });
    expect(mocks.submit).toHaveBeenCalledOnce();
    expect(mocks.collect).toHaveBeenCalledTimes(collectionsBeforeReconciliation);
  });

  it("discovers recent pending cases before walking older history", async () => {
    vi.stubEnv("CIELO_CHARGEBACK_START_DATE", "2000-01-01");
    mocks.page.mockResolvedValue({ items: [], last: true });
    await runChargebackSync();
    const first = mocks.page.mock.calls[0][1];
    expect(first.startDate > "2000-01-01").toBe(true);
    await runChargebackSync();
    const second = mocks.page.mock.calls[1][1];
    expect(second.endDate).toBe(first.startDate);
    expect(second.startDate < first.startDate).toBe(true);
  });

  it("submits a known case even when the scan and alert delivery fail", async () => {
    const known = await upsertChargeback(pool, pending);
    const exception = await upsertChargeback(pool, { ...pending, idCase: "102", idChargeback: "202" });
    await pool.query(
      "UPDATE chargeback_cases SET status='exception', issue='Dossiê incompleto', next_attempt_at=NOW()+INTERVAL '1 day' WHERE id=$1",
      [exception],
    );
    mocks.page.mockRejectedValue(new Error("test scan unavailable"));
    mocks.email.mockRejectedValue(new Error("test email unavailable"));

    const result = await runChargebackSync();
    expect(result).toMatchObject({ processed: 1 });
    expect(result?.failed).toBeGreaterThan(0);
    expect(mocks.page).toHaveBeenCalledOnce();
    expect(mocks.page).toHaveBeenCalledWith("PENDING", expect.objectContaining({ page: 0 }));
    expect((await pool.query("SELECT phase, page FROM chargeback_reconciliation WHERE id=1")).rows[0])
      .toMatchObject({ phase: "PENDING", page: 0 });
    expect(mocks.email).toHaveBeenCalled();
    expect(mocks.submit).toHaveBeenCalledOnce();
    expect((await pool.query("SELECT status, receipt FROM chargeback_cases WHERE id=$1", [known])).rows[0])
      .toMatchObject({ status: "submitted", receipt: { code: "102" } });
    expect((await pool.query("SELECT status, alert_key FROM chargeback_cases WHERE id=$1", [exception])).rows[0])
      .toMatchObject({ status: "exception", alert_key: null });
  });

  it("does not present a dossier when material evidence changes between collections", async () => {
    await upsertChargeback(pool, pending);
    mocks.collect.mockImplementationOnce(async (chargeback: CieloChargebackCase) => collectedEvidence(chargeback));
    mocks.collect.mockImplementation(async (chargeback: CieloChargebackCase) => {
      const evidence = collectedEvidence(chargeback);
      evidence.vouchers[0].usedAt = "2024-06-02 09:12:00";
      return evidence;
    });

    expect(await runChargebackSync()).toMatchObject({ processed: 1, failed: 0 });
    expect(mocks.collect).toHaveBeenCalledTimes(2);
    expect(mocks.submit).not.toHaveBeenCalled();
    expect((await pool.query("SELECT status, receipt, submitted_dossier_id FROM chargeback_cases")).rows[0])
      .toMatchObject({ status: "retry", receipt: null, submitted_dossier_id: null });
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM chargeback_dossiers")).rows[0].count).toBe(1);
  });

  it("reuses the archived dossier when an exception is collected again with unchanged evidence", async () => {
    const id = await upsertChargeback(pool, pending);
    let collection = 0;
    mocks.collect.mockImplementation(async (chargeback: CieloChargebackCase) => {
      const evidence = collectedEvidence(chargeback);
      evidence.capturedAt = `2024-06-03T10:0${collection++}:00Z`;
      evidence.communicationsCapturedAt = evidence.capturedAt;
      evidence.livePaymentCheckedAt = evidence.capturedAt;
      evidence.vouchers[0].state = "available";
      evidence.vouchers[0].usedAt = null;
      return evidence;
    });

    expect(await runChargebackSync()).toMatchObject({ processed: 1, failed: 0 });
    const first = await getChargebackDossier(id);
    expect(first?.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    await pool.query("UPDATE chargeback_cases SET next_attempt_at=NOW() WHERE id=$1", [id]);

    expect(await runChargebackSync()).toMatchObject({ processed: 1, failed: 0 });
    expect(mocks.collect).toHaveBeenCalledTimes(2);
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.email).toHaveBeenCalledOnce();
    expect((await pool.query("SELECT status FROM chargeback_cases WHERE id=$1", [id])).rows[0].status).toBe("exception");
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM chargeback_dossiers WHERE case_id=$1", [id])).rows[0].count).toBe(1);
    expect((await getChargebackDossier(id))?.sha256).toBe(first?.sha256);
  });

  it("recovers a receipt write failure from the archived remote PDF without sending again", async () => {
    await upsertChargeback(pool, pending);
    await pool.query(`
      CREATE FUNCTION fail_chargeback_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.status='submitting' AND NEW.status='submitted' AND NEW.submitted_at IS NOT NULL THEN
          RAISE EXCEPTION 'test receipt persistence failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fail_chargeback_receipt BEFORE UPDATE ON chargeback_cases
      FOR EACH ROW EXECUTE FUNCTION fail_chargeback_receipt();
    `);
    try {
      mocks.submit.mockImplementationOnce(async (_chargeback: CieloChargebackCase, pdf: Buffer) => {
        const { rows } = await pool.query("SELECT status, submitted_dossier_id FROM chargeback_cases");
        expect(rows[0]).toMatchObject({ status: "submitting", submitted_dossier_id: expect.any(Number) });
        remoteFile = pdf.toString("base64");
        return { code: "102" };
      });
      expect(await runChargebackSync()).toMatchObject({ processed: 0, failed: 1 });
      const interrupted = (await pool.query("SELECT status, receipt FROM chargeback_cases")).rows[0];
      expect(interrupted).toMatchObject({ status: "uncertain", receipt: null });
      expect(mocks.submit).toHaveBeenCalledOnce();
      expect(mocks.email).toHaveBeenCalledOnce();
    } finally {
      await pool.query("DROP TRIGGER fail_chargeback_receipt ON chargeback_cases; DROP FUNCTION fail_chargeback_receipt()");
    }

    remote = { ...pending, remoteStatus: "DONE", actionTakenCode: "RECUSADO" };
    await pool.query("UPDATE chargeback_cases SET next_attempt_at=NOW()");
    expect(await runChargebackSync()).toMatchObject({ processed: 1, failed: 0 });
    expect((await pool.query("SELECT status, receipt FROM chargeback_cases")).rows[0]).toMatchObject({
      status: "resolved",
      receipt: { confirmedBy: "supportDocument" },
    });
    expect(mocks.document).toHaveBeenCalledOnce();
    expect(mocks.submit).toHaveBeenCalledOnce();
  });

  it("runs only one concurrent worker against the same database", async () => {
    let markEntered = () => {};
    let release = () => {};
    const entered = new Promise<void>((resolve) => { markEntered = resolve; });
    const pause = new Promise<void>((resolve) => { release = resolve; });
    const first = withChargebackWorkerLock(async () => {
      markEntered();
      await pause;
      return "first";
    });
    await Promise.race([first, entered]);
    const second = vi.fn(async () => "second");
    try {
      expect(await withChargebackWorkerLock(second)).toBeNull();
      expect(second).not.toHaveBeenCalled();
    } finally {
      release();
      await expect(first).resolves.toBe("first");
    }
    expect(await withChargebackWorkerLock(second)).toBe("second");
  });

  it("reapplies the migration and prevents a case from pointing at another case's dossier", async () => {
    await pool.query(migration);
    const first = await upsertChargeback(pool, pending);
    const second = await upsertChargeback(pool, { ...pending, idCase: "102", idChargeback: "202" });
    const dossier = await saveChargebackDossier(pool, first, collectedEvidence(pending), Buffer.from("%PDF-test"), "test");
    await expect(pool.query("UPDATE chargeback_cases SET submitted_dossier_id=$2 WHERE id=$1", [second, dossier]))
      .rejects.toMatchObject({ code: "23503", constraint: "chargeback_submitted_dossier_case_fk" });
    await expect(pool.query("UPDATE chargeback_cases SET submitted_dossier_id=$2 WHERE id=$1", [first, dossier]))
      .resolves.toMatchObject({ rowCount: 1 });
  });
});
