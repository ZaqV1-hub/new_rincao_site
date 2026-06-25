import { describe, expect, it } from "vitest";
import { secureCompare } from "@/lib/secure-compare";

describe("secureCompare", () => {
  it("returns true only for equal strings", () => {
    expect(secureCompare("ops-token", "ops-token")).toBe(true);
    expect(secureCompare("ops-token", "wrong-token")).toBe(false);
    expect(secureCompare("ops-token", "ops-token-2")).toBe(false);
  });
});
