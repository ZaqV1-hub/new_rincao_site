import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { renderVoucherPdfBuffer } from "@/lib/voucher-pdf";

vi.mock("@react-pdf/renderer", () => ({
  Document: "div", Page: "section", Image: "img", Text: "span", View: "div",
  StyleSheet: { create: (styles: unknown) => styles },
  renderToBuffer: async (element: ReactElement) => Buffer.from(renderToStaticMarkup(element)),
}));

const input = {
  purchase: { id: 77, type: "ponli" as const, purchaseDate: "2026-04-20", statusLabel: "Pago" },
  customer: { name: "Cliente", cpf: "52998224725" },
  information: null, isSchool: false,
};
const voucher = { id: 11, number: "ABC123", typeLabel: "Adulto", visitDate: "2026-05-01", unitValue: "49.90", schoolName: null, participantName: null, schoolClassDisplay: null, qrCodeDataUrl: null };

describe("voucher PDF validity text", () => {
  it("shows the explicit interval and one use on any open day", async () => {
    const document = await renderVoucherPdfBuffer({ ...input, vouchers: [{ ...voucher, validFrom: "2026-05-01", validUntil: "2026-05-07" }] });
    const text = document.toString().replace(/<[^>]+>/g, "");
    expect(text).toContain("01/05/2026 a 07/05/2026");
    expect(text).toContain("uma utilização em qualquer dia com day use aberto");
    expect(text).not.toContain("Valido para a visita de");
  });
  it("retains the legacy visit date without inventing a validity interval", async () => {
    const document = await renderVoucherPdfBuffer({ ...input, vouchers: [voucher] });
    expect(document.toString().replace(/<[^>]+>/g, "")).toContain("Valido para a visita de 01/05/2026.");
  });
});
