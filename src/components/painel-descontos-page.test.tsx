import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelDescontosPage } from "@/components/painel-descontos-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("PainelDescontosPage", () => {
  it("renderiza tabela e sidebar legadas", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelDescontosPage, {
        data: {
          items: [
            {
              id: 1,
              typeId: 2,
              typeDescription: "Professor",
              name: "Desconto X",
              applicationType: "percentual",
              applicationTypeLabel: "Percentual",
              value: "10.00",
              valueLabel: "10,00",
            },
          ],
          page: 1,
          perPage: 50,
          total: 1,
          pageCount: 1,
          start: 1,
          end: 1,
          discountTypes: [],
        },
      }),
    );

    expect(html).toContain("Descontos");
    expect(html).toContain("Adicionar Desconto");
    expect(html).toContain("Lista de Categorias");
    expect(html).toContain("Desconto X");
  });
});
