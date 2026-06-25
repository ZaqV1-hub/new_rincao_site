import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

function context(slug: string[]) {
  return {
    params: Promise.resolve({ slug }),
  };
}

describe("/ingresso/[...slug] route", () => {
  it("redirects known legacy navigation URLs with a relative Next location", async () => {
    const response = await GET(
      new Request("https://example.test/ingresso/painel"),
      context(["painel"]),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/painel");
  });

  it("retires old form posts instead of redirecting them to pages or Zend", async () => {
    const response = await POST(
      new Request("https://example.test/ingresso/comprar/index/did/MTQ=", {
        method: "POST",
      }),
      context(["comprar", "index", "did", "MTQ="]),
    );
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error.code).toBe("endpoint_retired");
  });

  it("returns an explicit not-found error for unknown ingresso URLs", async () => {
    const response = await GET(
      new Request("https://example.test/ingresso/rota-desconhecida"),
      context(["rota-desconhecida"]),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("ingresso_route_not_found");
  });
});
