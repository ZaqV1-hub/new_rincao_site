import { describe, expect, it } from "vitest";
import { securityHeaders } from "@/lib/security-headers";

describe("securityHeaders", () => {
  it("defines the mandatory hardening headers", () => {
    expect(securityHeaders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "Strict-Transport-Security",
          value: expect.stringContaining("max-age"),
        }),
        expect.objectContaining({
          key: "X-Frame-Options",
          value: "DENY",
        }),
        expect.objectContaining({
          key: "X-Content-Type-Options",
          value: "nosniff",
        }),
      ]),
    );
  });
});
