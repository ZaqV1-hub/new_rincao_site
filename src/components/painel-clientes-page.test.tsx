import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelClientesPage } from "@/components/painel-clientes-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const data = {
  items: [
    {
      id: 248,
      typeId: 4,
      name: "ABRAHAO DE MORAES PROF. E.E.",
      typeName: "Escola",
      active: true,
    },
  ],
  page: 1,
  per: 20,
  total: 431,
  start: 1,
  end: 20,
  pageCount: 22,
  filters: {
    q: "",
    idtipo: "",
    status: "",
  },
  typeOptions: [
    { id: 4, name: "Escola" },
    { id: 2, name: "Cliente" },
  ],
};

describe("PainelClientesPage", () => {
  it("renderiza a lista principal no formato legado", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelClientesPage, { data }),
    );

    expect(html).toContain("Mostrando <strong>1</strong>-<strong>20</strong> de <strong>431</strong>");
    expect(html).toContain("Adicionar cliente");
    expect(html).toContain("Passeios");
    expect(html).toContain("Filtrar");
    expect(html).toContain("ABRAHAO DE MORAES PROF. E.E.");
    expect(html).toContain("Ativo");
    expect(html).toContain("Desativar");
    expect(html).toContain("Editar");
    expect(html).toContain("Excluir");
  });

  it("renderiza vazio simples quando nao ha clientes", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelClientesPage, {
        data: {
          ...data,
          items: [],
          total: 0,
          start: 0,
          end: 0,
          pageCount: 1,
        },
      }),
    );

    expect(html).toContain("Nenhum cliente encontrado.");
  });
});
