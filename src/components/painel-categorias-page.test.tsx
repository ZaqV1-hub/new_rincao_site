import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelCategoriasPage } from "@/components/painel-categorias-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("PainelCategoriasPage", () => {
  it("renderiza tabela e sidebar legadas", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelCategoriasPage, {
        data: {
          items: [{ id: 1, description: "Professor" }],
          page: 1,
          perPage: 50,
          total: 1,
          pageCount: 1,
          start: 1,
          end: 1,
        },
      }),
    );

    expect(html).toContain("Categorias");
    expect(html).toContain("Adicionar Categoria");
    expect(html).toContain("Lista de Descontos");
    expect(html).toContain("Professor");
  });
});
