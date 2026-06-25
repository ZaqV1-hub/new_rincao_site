import { describe, expect, it } from "vitest";
import { isPainelShellNavItemActive } from "@/lib/painel-shell-nav";

describe("painel-shell-nav", () => {
  it("keeps visao geral active only on the painel root", () => {
    expect(isPainelShellNavItemActive("/painel", { href: "/painel" })).toBe(true);
    expect(isPainelShellNavItemActive("/painel/clientes/passeios", { href: "/painel" })).toBe(
      false,
    );
  });

  it("keeps section items active on nested routes", () => {
    expect(
      isPainelShellNavItemActive("/painel/clientes/passeios", {
        href: "/painel/clientes",
      }),
    ).toBe(true);
    expect(
      isPainelShellNavItemActive("/painel/clientes/passeios", {
        href: "/painel/bilheteria",
      }),
    ).toBe(false);
  });
});
