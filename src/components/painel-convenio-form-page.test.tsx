import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PainelConvenioFormPage } from "@/components/painel-convenio-form-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("PainelConvenioFormPage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://example.test",
      },
    });
  });

  it("renderiza o formulario legado com calendarios nativos", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelConvenioFormPage, {
        mode: "edit",
        agreementId: 7,
        initialValues: {
          nmconvenio: "Convenio Alfa",
          dtini: "2026-05-01",
          dtfim: "2026-05-31",
          idtabpreco: "5",
        },
        priceTableOptions: [{ id: 5, name: "Tabela Bronze" }],
      }),
    );

    expect(html).toContain("Nome");
    expect(html).toContain("Tabela de Preco");
    expect(html).toContain('type="date"');
    expect(html).toContain("Enviar");
  });
});
