import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelClientTripsManager } from "@/components/painel-client-trips-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const data = {
  filters: {
    code: "ABC123",
    query: "Rincao",
    typeId: 4,
    status: "abe",
    fromDate: "2026-05-01",
    toDate: "2026-05-31",
    page: 1,
    pageSize: 20,
  },
  indicators: {
    performed: 3,
    upcoming: 5,
    total: 8,
  },
  typeOptions: [{ id: 4, name: "Escola" }],
  items: [
    {
      agendaId: 77,
      code: "ABC123",
      date: "2026-05-10",
      dateLabel: "10/05/2026",
      agendaType: "escol",
      agendaTypeLabel: "Escolar",
      status: "abe",
      statusLabel: "Aberta",
      acceptsFamily: false,
      slug: "slug-1",
      clientId: 248,
      clientName: "ABRAHAO DE MORAES PROF. E.E.",
      clientTypeId: 4,
      clientTypeName: "Escola",
      peopleCount: 18,
      purchaseLink: "/cliente/comprar?slug=slug-1",
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  pageCount: 1,
};

describe("PainelClientTripsManager", () => {
  it("renderiza lista de passeios no formato legado", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelClientTripsManager, { data }),
    );

    expect(html).toContain("Codigo Passeio");
    expect(html).toContain("Tipo de Cliente");
    expect(html).toContain("Qtd Pessoas");
    expect(html).toContain("Link Compra Participante");
    expect(html).toContain("ABRAHAO DE MORAES PROF. E.E.");
    expect(html).toContain("Detalhe");
    expect(html).toContain("Editar");
    expect(html).toContain("Desvincular");
    expect(html).toContain("Copiar link");
    expect(html).toContain("Filtrar");
    expect(html).toContain("Adicionar passeio");
  });
});
