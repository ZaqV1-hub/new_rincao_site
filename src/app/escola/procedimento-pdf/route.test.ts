import { describe, expect, it } from "vitest";

describe("escola/procedimento-pdf route", () => {
  it("redirects to the bundled procedure PDF asset", async () => {
    const { GET } = await import("@/app/escola/procedimento-pdf/route");
    const response = await GET(
      new Request("https://example.com/escola/procedimento-pdf"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.com/legacy/Procedimento_Compra_Ingresso_Escola.pdf",
    );
  });
});
