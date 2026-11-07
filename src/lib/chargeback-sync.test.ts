import { beforeEach, describe, expect, it, vi } from "vitest";
import { processChargeback } from "@/lib/chargeback-sync";
import type { StoredChargeback } from "@/lib/chargeback-repository";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({ list: vi.fn(), lifecycle: vi.fn(), document: vi.fn(), collect: vi.fn(), evaluate: vi.fn(), render: vi.fn(), save: vi.fn(), present: vi.fn(), update: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/cielo-chargeback", () => ({ listCieloChargebacks: mocks.list, getCieloChargebackLifecycle: mocks.lifecycle, getCieloChargebackDocument: mocks.document, isCieloChargebackConfigured: () => true }));
vi.mock("@/lib/chargeback-dossier", () => ({ collectChargebackEvidence: mocks.collect, evaluateChargebackEvidence: mocks.evaluate, describeChargebackIssue: (code: string) => code }));
vi.mock("@/lib/chargeback-dossier-pdf", () => ({ renderChargebackDossierPdf: mocks.render }));
vi.mock("@/lib/chargeback-submission", () => ({ presentChargebackDefense: mocks.present }));
vi.mock("@/lib/chargeback-repository", async (original) => ({ ...await original<typeof import("@/lib/chargeback-repository")>(), saveChargebackDossier: mocks.save, updateChargebackState: mocks.update }));

const row = {
  id: 1, status: "queued", attempts: 0, submitted_dossier_id: null,
  payload: { idCase: "10", idChargeback: "20", establishmentNumber: "1234567890", treatmentDeadline: "2099-01-01", transactionAmount: "100.00", remoteStatus: "PENDING", transactionDetails: { transactionDate: "2026-11-01" }, chargebackDetails: { reasonCode: "131", reasonDescription: "Serviço não recebido" } },
} as StoredChargeback;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([row.payload]);
  mocks.lifecycle.mockResolvedValue({ message: "Em análise" });
  mocks.document.mockResolvedValue(null);
  mocks.collect.mockResolvedValue({ case: row.payload, purchaseId: 123, paymentId: "payment", capturedAt: "2026-11-03T12:00:00Z", issues: [] });
  mocks.evaluate.mockReturnValue({ eligible: true, reason: "Serviço utilizado conforme registros anexos.", issues: [], policyVersion: "v1" });
  mocks.render.mockResolvedValue(Buffer.from("%PDF-1"));
  mocks.save.mockResolvedValue(5);
  mocks.query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
});

describe("automatic chargeback processing", () => {
  it("collects, archives and submits an eligible case without panel action", async () => {
    await processChargeback({ query: mocks.query }, row);
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.present).toHaveBeenCalledWith({ query: mocks.query }, 1, row.payload, 5, Buffer.from("%PDF-1"), "Serviço utilizado conforme registros anexos.");
  });
  it("archives available evidence but does not submit incomplete proof", async () => {
    mocks.evaluate.mockReturnValue({ eligible: false, reason: "", issues: ["Utilização parcial."], policyVersion: "v1" });
    await processChargeback({ query: mocks.query }, row);
    expect(mocks.present).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), 1, "exception", "Utilização parcial.", expect.any(Number));
  });
  it("reconciles an interrupted submission without sending again", async () => {
    await processChargeback({ query: mocks.query }, { ...row, status: "submitting", submitted_dossier_id: 5 });
    expect(mocks.present).not.toHaveBeenCalled();
    expect(mocks.collect).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), 1, "uncertain", expect.any(String), expect.any(Number));
  });
  it("does not submit a case treated externally", async () => {
    mocks.list.mockResolvedValue([{ ...row.payload, remoteStatus: "DONE", actionTakenCode: "ACATADO" }]);
    await processChargeback({ query: mocks.query }, row);
    expect(mocks.present).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), 1, "remote_done", null, expect.any(Number));
  });
  it("never reopens a durable DONE case from a stale PENDING response", async () => {
    await processChargeback({ query: mocks.query }, { ...row, payload: { ...row.payload, remoteStatus: "DONE" } });
    expect(mocks.present).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), 1, "remote_done", null, expect.any(Number));
  });
  it("reconciles its own archived PDF when an uncertain submission becomes DONE", async () => {
    const pdf = Buffer.from("%PDF-test");
    mocks.list.mockResolvedValue([{ ...row.payload, remoteStatus: "DONE" }]);
    mocks.document.mockResolvedValue({ file: pdf.toString("base64") });
    mocks.query.mockResolvedValue({ rows: [{ sha256: createHash("sha256").update(pdf).digest("hex") }], rowCount: 1 });
    await processChargeback({ query: mocks.query }, { ...row, status: "uncertain", submitted_dossier_id: 5 });
    expect(mocks.present).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes("status='submitted'"))).toBe(true);
  });
  it("rejects expired cases before submission", async () => {
    mocks.list.mockResolvedValue([{ ...row.payload, treatmentDeadline: "2000-01-01" }]);
    await processChargeback({ query: mocks.query }, row);
    expect(mocks.present).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), 1, "exception", expect.stringContaining("Prazo"), expect.any(Number));
  });
  it("does not trust another establishment with the same case identifier", async () => {
    mocks.list.mockResolvedValue([{ ...row.payload, establishmentNumber: "9999999999" }]);
    await expect(processChargeback({ query: mocks.query }, row)).rejects.toThrow();
    expect(mocks.present).not.toHaveBeenCalled();
  });
  it("does not send when case changes while the PDF is generated", async () => {
    mocks.list.mockResolvedValueOnce([row.payload]).mockResolvedValue([{ ...row.payload, remoteStatus: "DONE" }]);
    await processChargeback({ query: mocks.query }, row);
    expect(mocks.present).not.toHaveBeenCalled();
  });
});
