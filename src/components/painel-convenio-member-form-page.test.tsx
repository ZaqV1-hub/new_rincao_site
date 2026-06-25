import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PainelConvenioMemberFormPage } from "@/components/painel-convenio-member-form-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("PainelConvenioMemberFormPage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://example.test",
      },
    });
  });

  it("renderiza o formulario legado com cpf e datas", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelConvenioMemberFormPage, {
        agreementId: 7,
        initialValues: {
          cpf: "12345678901",
          qtcompradia: "2",
          dtiniado: "2026-05-01",
          dtfimado: "2026-05-31",
        },
        mode: "edit",
      }),
    );

    expect(html).toContain("CPF");
    expect(html).toContain("Quantidade de compra por dia");
    expect(html).toContain('type="date"');
    expect(html).toContain("Enviar");
  });
});
