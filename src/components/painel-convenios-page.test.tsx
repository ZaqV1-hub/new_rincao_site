import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PainelConveniosPage } from "@/components/painel-convenios-page";
import type { PainelConvenioListResult } from "@/lib/painel-convenios";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const data: PainelConvenioListResult = {
  items: [
    {
      id: 7,
      name: "Convenio Alfa",
      priceTableId: 5,
      priceTableName: "Tabela Bronze",
      startDate: "01/05/2026",
      endDate: "31/05/2026",
      statusCode: "ati",
      statusLabel: "Ativo",
    },
  ],
  filters: {
    name: "Alfa",
    status: "ati",
    priceTableId: "5",
    periodFrom: "01/05/2026",
    periodTo: "31/05/2026",
    page: 1,
    perPage: 30,
  },
  page: 1,
  perPage: 30,
  total: 1,
  pageCount: 1,
  start: 1,
  end: 1,
  priceTableOptions: [{ id: 5, name: "Tabela Bronze" }],
};

describe("PainelConveniosPage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      confirm: vi.fn(() => true),
    });
  });

  it("renderiza sidebar e colunas da lista legada", () => {
    const html = renderToStaticMarkup(React.createElement(PainelConveniosPage, { data }));

    expect(html).toContain("Lista de conv");
    expect(html).toContain("Adicionar convenio");
    expect(html).toContain("Filtrar");
    expect(html).toContain("Tabela de Preco");
    expect(html).toContain("Convenio Alfa");
    expect(html).toContain("Desativar");
  });
});
