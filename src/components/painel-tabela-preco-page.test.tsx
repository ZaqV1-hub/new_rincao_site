import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelTabelaPrecoPage } from "@/components/painel-tabela-preco-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("PainelTabelaPrecoPage", () => {
  it("renderiza valores de bilheteria como Adulto e Crianca", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelTabelaPrecoPage, {
        legacyResources: ["vis_tabpre"],
        data: {
          filters: {
            nome: "",
            status: "",
          },
          items: [
            {
              id: 1,
              name: "Padrao",
              normalValue: "70,00",
              childValue: "50,00",
              gateNormalValue: "80,00",
              gateChildValue: "70,00",
              status: "ati",
              statusLabel: "Ativo",
            },
          ],
          page: 1,
          per: 30,
          total: 1,
          pageCount: 1,
          start: 1,
          end: 1,
        },
      }),
    );

    expect(html).toContain("Adulto R$ 80,00");
    expect(html).toContain("Criança R$ 70,00");
    expect(html).not.toContain("Passaporte");
  });
});
