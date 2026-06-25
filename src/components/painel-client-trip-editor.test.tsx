import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelClientTripEditor } from "@/components/painel-client-trip-editor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const createData = {
  mode: "create" as const,
  preselectedAgendaId: 77,
  preselectedClientId: 248,
  agendas: [
    {
      agendaId: 77,
      date: "2026-05-10",
      dateLabel: "10/05/2026",
      agendaType: "escol",
      agendaTypeLabel: "Escolar",
      status: "abe",
      statusLabel: "Aberta",
    },
  ],
  clients: [
    {
      clientId: 248,
      name: "ABRAHAO DE MORAES PROF. E.E.",
      typeId: 4,
      typeName: "Escola",
    },
  ],
  faixas: [{ minAge: 6, maxAge: 12, value: "25.00" }],
};

const editData = {
  mode: "edit" as const,
  agenda: {
    agendaId: 77,
    date: "2026-05-10",
    dateLabel: "10/05/2026",
    agendaType: "escol",
    agendaTypeLabel: "Escolar",
    status: "abe",
    statusLabel: "Aberta",
  },
  client: {
    clientId: 248,
    name: "ABRAHAO DE MORAES PROF. E.E.",
    typeId: 4,
    typeName: "Escola",
  },
  status: "abe",
  statusLabel: "Aberta",
  acceptsFamily: true,
  slug: "slug-1",
  faixas: [{ minAge: 6, maxAge: 12, value: "25.00" }],
};

describe("PainelClientTripEditor", () => {
  it("renderiza tela de vincular passeio no formato legado", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelClientTripEditor, {
        data: createData,
      }),
    );

    expect(html).toContain("Vincular passeio");
    expect(html).toContain("Aceita familia?");
    expect(html).toContain("Faixas de preco");
    expect(html).toContain("Adicionar faixa");
    expect(html).toContain("Vincular");
  });

  it("renderiza tela de editar passeio no formato legado", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelClientTripEditor, {
        data: editData,
      }),
    );

    expect(html).toContain("Editar passeio");
    expect(html).toContain("Alterar data do passeio");
    expect(html).toContain("Mover para data selecionada");
    expect(html).toContain("Salvar alteracoes");
    expect(html).toContain("ABRAHAO DE MORAES PROF. E.E.");
    expect(html).toContain("10/05/2026");
  });
});
