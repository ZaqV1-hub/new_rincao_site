import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PainelConvenioMembersPage } from "@/components/painel-convenio-members-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("PainelConvenioMembersPage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      confirm: vi.fn(() => true),
    });
  });

  it("renderiza a tabela e a sidebar de conveniados", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelConvenioMembersPage, {
        data: {
          agreementId: 7,
          agreementName: "Convenio Alfa",
          items: [
            {
              agreementId: 7,
              agreementName: "Convenio Alfa",
              cpf: "12345678901",
              cpfLabel: "123.456.789-01",
              userName: "Joao Silva",
              dailyPurchaseLimit: 2,
              startDate: "01/05/2026",
              endDate: "31/05/2026",
              statusCode: "ati",
              statusLabel: "Ativo",
            },
          ],
          filters: {
            cpf: null,
            status: null,
            periodFrom: null,
            periodTo: null,
            page: 1,
            perPage: 10,
          },
          page: 1,
          perPage: 10,
          total: 1,
          pageCount: 1,
          start: 1,
          end: 1,
        },
      }),
    );

    expect(html).toContain("Lista de conveniados");
    expect(html).toContain("Adicionar conveniado");
    expect(html).toContain("Importar conveniados");
    expect(html).toContain("123.456.789-01");
    expect(html).toContain("Desativar");
  });
});
