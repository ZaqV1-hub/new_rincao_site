import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checkedFiles = [
  "src/lib/painel-agenda.ts",
  "src/app/api/painel/agenda/route.ts",
  "src/app/api/painel/site-content/route.ts",
  "src/app/comprar/[id]/page.tsx",
  "src/app/painel/(protected)/bilheteria/vendas/page.tsx",
  "src/lib/purchase-repository.ts",
  "src/components/painel-agenda-editor.tsx",
  "src/components/painel-site-manager.tsx",
];

describe("agenda product availability cleanup", () => {
  it("removes the per-date product availability module and payload fields", () => {
    expect(existsSync("src/lib/painel-agenda-product-availability.ts")).toBe(
      false,
    );

    for (const file of checkedFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/painel-agenda-product-availability/);
      expect(source).not.toMatch(/passportIds|addonIds|selectedPassportIds|selectedAddonIds/);
    }
  });
});
