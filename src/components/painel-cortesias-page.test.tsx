import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelCortesiasPage } from "@/components/painel-cortesias-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("PainelCortesiasPage", () => {
  it("renderiza tabela e sidebar legadas", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelCortesiasPage, {
        data: {
          items: [{ id: 1, name: "Diretoria" }],
          page: 1,
          perPage: 20,
          total: 1,
          pageCount: 1,
          start: 1,
          end: 1,
        },
      }),
    );

    expect(html).toContain("Cortesias | Autorizadores");
    expect(html).toContain("Lista de autorizadores");
    expect(html).toContain("Novo autorizador");
    expect(html).toContain("Diretoria");
  });
});
