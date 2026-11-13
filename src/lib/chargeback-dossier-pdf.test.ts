import React from "react";
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

function renderedText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(renderedText).join(" ");
  if (!React.isValidElement(node)) return "";
  const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  if (typeof element.type === "function") {
    return renderedText((element.type as (props: typeof element.props) => React.ReactNode)(element.props));
  }
  return renderedText(element.props.children);
}

function lastDocumentText() {
  return renderedText(vi.mocked(renderToBuffer).mock.calls.at(-1)![0]).replace(/\s+/g, " ");
}

describe("chargeback dossier PDF", () => {
  it("renders deterministic valid bytes with a fixed capture timestamp", async () => {
    const first = await renderChargebackDossierPdf(evidence);
    expect(first.subarray(0, 5).toString()).toBe("%PDF-");
    expect(await renderChargebackDossierPdf(evidence)).toEqual(first);
  });

  it("labels declaration provenance, ECI conflicts and fraud limitations without asserting authorization", async () => {
    const payment: NonNullable<ChargebackEvidence["livePayment"]> = {
      id: "EXAMPLE", tid: "TID-EXAMPLE", nsu: "30", authorization: "1234", establishment: "31000",
      receivedAt: "2026-10-09T12:00:00", capturedAt: "2026-10-09T12:01:00", status: "2", ledgerStatus: "3",
      amountCents: 10000, reversedCents: 0, reversalRecorded: false, installments: 1, brand: "Visa", lastFour: "1234",
      eci: "", eciSources: { payment: "7", externalAuthentication: "05", conflict: true },
      holderName: "Titular Declarado", buyerDocumentMasked: "***.***.***-01", buyerName: "Compradora da transação",
      buyerEmail: "compra@example.com", merchantOrderId: "10",
      authentication: { version: "2.2.0", referencePresent: true, cavvPresent: true, requested: true, dataOnly: false },
    };
    await renderChargebackDossierPdf({ ...evidence,
      case: { ...evidence.case, chargebackDetails: { reasonCode: "104", reasonDescription: "Fraude" } },
      purchase: { date: "2026-10-09", totalCents: 10000, status: "conc", buyerName: "Cadastro atual", buyerEmail: "atual@example.com" },
      paymentAttempts: [payment],
      vouchers: [{ id: 100, number: "V100", category: "Adulto", visitDate: "2026-10-10", unitCents: 10000, state: "used", usedAt: "2026-10-11 09:00:00", invalidatedAt: null }],
    });
    const text = lastDocumentText();
    expect(text).toContain("Titular informado na transação · Titular Declarado");
    expect(text).toContain("Documento mascarado ***.***.***-01");
    expect(text).toContain("Cadastro consultado na coleta");
    expect(text).toContain("ECI divergente");
    expect(text).toContain("Payment.Eci 7");
    expect(text).toContain("ExternalAuthentication.Eci 05");
    expect(text).toContain("não comprovam, isoladamente, autenticação ou autorização do portador");
    expect(text).toContain("Vínculo entre comprador, portador e usuário do ingresso não comprovado");
    expect(text).toContain("Data de utilização diferente da visita prevista");
    expect(text.indexOf("Entrega — registros")).toBeLessThan(text.indexOf("Ingressos — estado atual"));
  });

  it("labels current account metadata and previous purchases without claiming uncontested transactions", async () => {
    await renderChargebackDossierPdf({ ...evidence, customerHistory: {
      accounts: [{ source: "usuario_site_conta", registeredOn: "2025-01-01", lastLoginAt: "2026-11-12 10:00:00" }],
      previousPurchases: { total: 3, completed: 1, cancelled: 1, other: 1, firstDate: "2025-04-01", lastDate: "2026-10-08" },
    } });
    const text = lastDocumentText();
    expect(text).toContain("Relacionamento cadastral — contexto auxiliar");
    expect(text).toContain("usuario_site_conta");
    expect(text).toContain("2026-11-12 10:00:00");
    expect(text).toContain("não é histórico de sessões nem prova de login no momento da compra");
    expect(text).toContain("3 registros anteriores");
    expect(text).toContain("Concluídos 1 · Cancelados/estornados 1 · Outros 1");
    expect(text).toContain("não comprova mesmo cartão, legitimidade ou ausência de contestação");
    expect(text).not.toContain("compras anteriores sem contestação");
  });

  it("renders old evidence without making missing fields into negative authentication results", async () => {
    await renderChargebackDossierPdf(evidence);
    const text = lastDocumentText();
    expect(text).toContain("Autenticação do portador não comprovada por este dossiê");
    expect(text).toContain("datas desconhecidas permanecem indisponíveis");
    expect(text).not.toContain("portador não autenticado");
  });

  it("renders legacy payment snapshots and long names with multiple tickets", async () => {
    const legacy: NonNullable<ChargebackEvidence["livePayment"]> = {
      id: "EXAMPLE", tid: "TID-EXAMPLE", nsu: "30", authorization: "1234", establishment: "31000",
      receivedAt: "2026-10-09T12:00:00", capturedAt: "", status: "2", ledgerStatus: "3", amountCents: 10000,
      reversedCents: null, reversalRecorded: false, installments: 1, brand: "Visa", lastFour: "1234", eci: "05",
      buyerName: "Nome composto com acentuação e sobrenome ".repeat(3), buyerEmail: "compra@example.com", merchantOrderId: "10",
    };
    const file = await renderChargebackDossierPdf({ ...evidence, paymentAttempts: [legacy], vouchers: Array.from({ length: 20 }, (_, index) => ({
      id: index + 1, number: `V${index + 1}`, category: "Adulto", visitDate: "2026-10-10", unitCents: 500,
      state: "used" as const, usedAt: "2026-10-10 09:00:00", invalidatedAt: null,
    })) });
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
    expect(lastDocumentText()).toContain("Titular informado na transação · Indisponível");
    expect(lastDocumentText()).toContain("ECI informado 05");
    expect(lastDocumentText()).toContain("Ingresso V20");
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
