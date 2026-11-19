import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ChargebackEvidence } from "@/lib/chargeback-dossier";
import { renderChargebackDossierPdf } from "@/lib/chargeback-dossier-pdf";

vi.mock("@react-pdf/renderer", async (original) => {
  const renderer = await original<typeof import("@react-pdf/renderer")>();
  return { ...renderer, renderToBuffer: vi.fn(renderer.renderToBuffer) };
});

const evidence: ChargebackEvidence = {
  case: {
    idCase: "61314023", idChargeback: "30226247", establishmentNumber: "2899426197",
    treatmentDeadline: "2026-11-28", transactionAmount: "368.48", remoteStatus: "PENDING",
    process: "PRIMEIRO_CHARGEBACK",
    transactionDetails: { tid: "TID-TEST", nsu: "123", authorization: "456", transactionDate: "2026-11-01",
      cardAssociationName: "MASTER", truncatedCard: "**** 7194", currency: "REAL" },
    chargebackDetails: { reasonCode: "4837", reasonDescription: "Sem Autorização do Portador do Cartão", receptionDate: "2026-11-17" },
  },
  purchaseId: 196343, paymentId: "PAYMENT-TEST", capturedAt: "2026-11-19T12:00:00Z",
  firstNotifiedAt: "2026-11-18T07:06:32Z", issues: [], link: { method: "tid", establishmentVerified: true },
  purchase: { date: "2026-11-01", time: "11:12:00", totalCents: 36000, status: "conc", buyerName: "Cliente de teste", buyerEmail: "" },
  installmentQuote: { baseCents: 36000, chargedCents: 36848, feeCents: 848, installments: 3, brand: "Mastercard" },
  paymentAttempts: [{ id: "PAYMENT-TEST", tid: "TID-TEST", nsu: "123", authorization: "456", establishment: "2899426197",
    receivedAt: "2026-11-01T11:13:17", capturedAt: "2026-11-01T11:13:17", status: "2", ledgerStatus: "3",
    amountCents: 36848, reversedCents: null, reversalRecorded: false, installments: 3, brand: "Master", lastFour: "7194",
    eci: "0", buyerName: "Cliente de teste", buyerEmail: "", merchantOrderId: "196343" }],
  livePayment: null, livePaymentCheckedAt: null,
  vouchers: [7000, 7000, 7000, 5000, 5000, 5000].map((unitCents, index) => ({
    id: 100 + index, number: "VOUCHER-" + index, category: unitCents === 7000 ? "Adulto" : "Criança",
    visitDate: "2026-11-01", unitCents, state: "used", usedAt: "2026-11-01 12:01:30", invalidatedAt: null,
  })),
  voucherEvents: [], deliveryEvents: [], emailQueued: true, communicationsCapturedAt: null,
};

function renderedText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(renderedText).join(" ");
  if (!React.isValidElement(node)) return "";
  const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  if (typeof element.type === "function") {
    return renderedText((element.type as (props: typeof element.props) => React.ReactNode)(element.props));
  }
  return renderedText(element.props.children);
}

function documentText() {
  return renderedText(vi.mocked(renderToBuffer).mock.calls.at(-1)![0]).replace(/\s+/g, " ");
}

describe("chargeback review package", () => {
  it("starts with the dossier followed by the purchase receipt and explains the recorded interest and chronology", async () => {
    const first = await renderChargebackDossierPdf(evidence);
    expect(first.subarray(0, 5).toString()).toBe("%PDF-");
    expect(await renderChargebackDossierPdf(evidence)).toEqual(first);
    const text = documentText();
    expect(text.indexOf("Dossiê de contestação")).toBeLessThan(text.indexOf("DADOS DA COMPRA / RESERVA"));
    expect(text).toContain("O Comprovante de Compra de Ingressos está na próxima página.");
    expect(text.toLowerCase()).not.toContain("nota fiscal");
    expect(text).toContain("VOUCHER-5");
    expect(text).toContain("R$ 8,48 de juros");
    expect(text).toContain("01/11/2026");
    expect(text).toContain("17/11/2026");
    expect(text).toContain("foram utilizados antes do recebimento");
    expect(text).toContain("autorização do cartão precisam ser avaliadas");
    expect(text).not.toContain("Há divergência");
    expect(text).not.toContain("Histórico operacional");
    expect(text).not.toContain("agenda no momento da captura");
  });

  it("does not turn the integration timestamp into a cardholder dispute date", async () => {
    await renderChargebackDossierPdf({ ...evidence, case: {
      ...evidence.case, chargebackDetails: { ...evidence.case.chargebackDetails, receptionDate: undefined },
    } });
    const text = documentText();
    expect(text).toContain("Primeiro registro da contestação no Rincão em 18/11/2026");
    expect(text).toContain("data em que o portador abriu a contestação no banco não está disponível");
    expect(text).not.toContain("foram utilizados antes do recebimento");
  });

  it("marks partial use and unexplained differences for individual review", async () => {
    await renderChargebackDossierPdf({ ...evidence, installmentQuote: null,
      vouchers: evidence.vouchers.map((v, index) => index === 0 ? { ...v, state: "available", usedAt: null } : v) });
    const text = documentText();
    expect(text).toContain("Foram utilizados 5 de 6 ingressos");
    expect(text).toContain("Há divergência");
    expect(text).not.toContain("foram utilizados antes do recebimento");
  });

  it("enforces the size and page limits on the combined package", async () => {
    vi.mocked(renderToBuffer).mockResolvedValueOnce(Buffer.alloc(8_000_001));
    await expect(renderChargebackDossierPdf(evidence)).rejects.toThrow("chargeback_pdf_size_limit");
    vi.mocked(renderToBuffer).mockResolvedValueOnce(Buffer.from("%PDF-\n" + "/Type /Page\n".repeat(11)));
    await expect(renderChargebackDossierPdf(evidence)).rejects.toThrow("chargeback_pdf_page_limit");
  });
});
