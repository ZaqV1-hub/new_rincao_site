import { describe, expect, it } from "vitest";
import { getDefaultPainelPath, getLegacyPanelResources, normalizeLegacyPanelResource } from "@/lib/painel-access";

describe("painel-access", () => {
  it("routes manager sessions to the painel home by default", () => {
    expect(getDefaultPainelPath(1)).toBe("/painel");
  });
  it('recognizes counting access and grants it by default only to managers', () => {
    expect(normalizeLegacyPanelResource('vis_portaria')).toBe('vis_portaria');
    expect(getLegacyPanelResources(1)).toContain('vis_portaria');
    for(const role of [2,3,4,5] as const)expect(getLegacyPanelResources(role)).not.toContain('vis_portaria');
    expect(normalizeLegacyPanelResource('vis_contagem')).toBe('vis_contagem');
    expect(getLegacyPanelResources(1)).toContain('vis_contagem');
    for (const role of [2,3,4,5] as const) expect(getLegacyPanelResources(role)).not.toContain('vis_contagem');
  });

  it("routes operator sessions to the painel home by default", () => {
    expect(getDefaultPainelPath(2)).toBe("/painel");
  });

  it("routes box office sessions to bilheteria by default", () => {
    expect(getDefaultPainelPath(3)).toBe("/painel/bilheteria");
  });

  it("keeps representative sessions on the painel root by default", () => {
    expect(getDefaultPainelPath(4)).toBe("/painel");
  });
});
