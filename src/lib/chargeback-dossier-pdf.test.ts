import { describe, expect, it, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ChargebackEvidence } from "@/lib/chargeback-dossier";
import { renderChargebackDossierPdf } from "@/lib/chargeback-dossier-pdf";

vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const renderer = await importOriginal<typeof import("@react-pdf/renderer")>();
  return { ...renderer, renderToBuffer: vi.fn(renderer.renderToBuffer) };
});

const evidence: ChargebackEvidence = {
  case: {
    idCase: "11000",
    idChargeback: "21000",
    establishmentNumber: "31000",
    treatmentDeadline: "2026-11-30",
    transactionAmount: "100.00",
    process: "PRIMEIRO_CHARGEBACK",
    transactionDetails: {
      tid: "TID-EXAMPLE",
      currency: "REAL",
      nsu: "30",
      authorization: "1234",
      transactionDate: "2026-10-09",
      cardAssociationName: "Visa",
      truncatedCard: "**** 1234",
    },
    chargebackDetails: { reasonCode: "131", reasonDescription: "Serviço não prestado" },
    remoteStatus: "PENDING",
  },
  purchaseId: 10,
  paymentId: "EXAMPLE",
  capturedAt: "2026-11-03T19:00:00.000Z",
  issues: ["voucher_audit_incomplete"],
  link: { method: "tid", establishmentVerified: false },
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

describe("chargeback dossier PDF", () => {
  it("renders deterministic valid bytes with a fixed capture timestamp", async () => {
    const first = await renderChargebackDossierPdf(evidence);
    expect(first.subarray(0, 5).toString()).toBe("%PDF-");
    expect(await renderChargebackDossierPdf(evidence)).toEqual(first);
  });

  it("rejects generated buffers over the Cielo upload limit", async () => {
    vi.mocked(renderToBuffer).mockResolvedValueOnce(Buffer.alloc(8_000_001));
    await expect(renderChargebackDossierPdf(evidence)).rejects.toThrow("chargeback_pdf_size_limit");
  });

  it("rejects dossiers over ten pages instead of dropping events", async () => {
    const longEvidence = {
      ...evidence,
      voucherEvents: Array.from({ length: 950 }, (_, index) => ({
        id: index + 1,
        action: "validar",
        mode: "purchase",
        actor: "Operadora",
        occurredAt: "2026-10-10T12:00:00.000Z",
        voucherIds: [100],
      })),
    };
    await expect(renderChargebackDossierPdf(longEvidence)).rejects.toThrow("chargeback_pdf_page_limit");
  }, 20_000);
});
