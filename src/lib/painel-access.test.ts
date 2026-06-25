import { describe, expect, it } from "vitest";
import { getDefaultPainelPath } from "@/lib/painel-access";

describe("painel-access", () => {
  it("routes manager sessions to the painel home by default", () => {
    expect(getDefaultPainelPath(1)).toBe("/painel");
  });

  it("routes operator sessions to the painel home by default", () => {
    expect(getDefaultPainelPath(2)).toBe("/painel");
  });

  it("routes box office sessions to bilheteria by default", () => {
    expect(getDefaultPainelPath(3)).toBe("/painel/bilheteria");
  });
});
