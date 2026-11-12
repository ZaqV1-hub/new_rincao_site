import { afterEach, describe, expect, it, vi } from "vitest";
import { getOperationalParkId } from "@/lib/operational-day-contract";

describe("operational park configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to Rincão only when the park is unset", () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", undefined);
    expect(getOperationalParkId()).toBe("rincao");
  });

  it("selects Estância from server configuration", () => {
    vi.stubEnv("OPERATIONAL_PARK_ID", "estancia");
    expect(getOperationalParkId()).toBe("estancia");
  });

  it.each(["", "unknown"])("rejects invalid configuration (%j)", (park) => {
    vi.stubEnv("OPERATIONAL_PARK_ID", park);
    expect(() => getOperationalParkId()).toThrow("OPERATIONAL_PARK_ID");
  });
});
