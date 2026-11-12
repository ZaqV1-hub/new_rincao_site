import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PainelOperationalCatalog } from "./painel-operational-catalog";

describe("PainelOperationalCatalog", () => {
  it("distinguishes unavailable online sales from a free online service", () => {
    const html = renderToStaticMarkup(<PainelOperationalCatalog kind="services" canEdit={true} items={[
      { id: 1, name: "Estacionamento", description: "", active: true, version: 1, sitePriceCents: null, gatePriceCents: 2500 },
      { id: 2, name: "Armário", description: "", active: false, version: 2, sitePriceCents: 0, gatePriceCents: 1200 },
    ]} />);
    expect(html).toContain("Só na bilheteria");
    expect(html).toContain("0,00");
    expect(html).toContain("25,00");
    expect(html).toContain("Inativo");
  });

  it("allows consultation without exposing edit controls to non-managers", () => {
    const html = renderToStaticMarkup(<PainelOperationalCatalog kind="locations" canEdit={false} items={[
      { id: 1, name: "Piscina", description: "Entrada da piscina", active: true, version: 1 },
    ]} />);
    expect(html).toContain("Piscina");
    expect(html).not.toContain("Editar");
    expect(html).not.toContain("Novo local");
  });

  it("shows an honest empty state without invented catalog entries", () => {
    const html = renderToStaticMarkup(<PainelOperationalCatalog kind="locations" canEdit={true} items={[]} />);
    expect(html).toContain("Nenhum local cadastrado");
    expect(html).toContain("Novo local");
  });
});
