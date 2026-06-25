import { describe, expect, it } from "vitest";

describe("legacy public payment route aliases", () => {
  it("serves checkout-link from the native checkout handler", async () => {
    const legacyRoute = await import(
      "@/app/ingresso/pagamento/checkout-link/route"
    );
    const nativeRoute = await import("@/app/api/checkout/checkout-link/route");

    expect(legacyRoute.POST).toBe(nativeRoute.POST);
  });

  it("serves 3DS token from the native checkout handler", async () => {
    const legacyRoute = await import(
      "@/app/ingresso/pagamento/cielo3ds-token/route"
    );
    const nativeRoute = await import("@/app/api/checkout/cielo3ds-token/route");

    expect(legacyRoute.GET).toBe(nativeRoute.GET);
  });

  it("serves checkout status from the native checkout handler", async () => {
    const legacyRoute = await import("@/app/ingresso/pagamento/status/route");
    const nativeRoute = await import("@/app/api/checkout/status/route");

    expect(legacyRoute.GET).toBe(nativeRoute.GET);
  });

  it("serves notifications from the native checkout handler", async () => {
    const legacyRoute = await import(
      "@/app/ingresso/pagamento/notificacao/route"
    );
    const nativeRoute = await import("@/app/api/checkout/notification/route");

    expect(legacyRoute.POST).toBe(nativeRoute.POST);
  });
});
