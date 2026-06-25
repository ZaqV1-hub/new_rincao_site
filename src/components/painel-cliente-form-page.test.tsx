import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PainelClienteFormPage } from "@/components/painel-cliente-form-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

const client = {
  client: {
    id: 248,
    typeId: 4,
    name: "ABRAHAO DE MORAES PROF. E.E.",
    typeName: "Escola",
    active: true,
    createdAt: "2026-05-06T10:00:00.000Z",
    updatedAt: "2026-05-06T11:00:00.000Z",
  },
  tripDates: [
    {
      agendaId: 77,
      date: "2026-05-10",
      statusCode: "abe",
      statusLabel: "Aberto",
    },
  ],
  education: {
    client: {
      id: 248,
      name: "ABRAHAO DE MORAES PROF. E.E.",
      typeId: 4,
      typeName: "Escola",
      isSchool: true,
      active: true,
    },
    standardPeriodOptions: [],
    classes: [],
  },
};

describe("PainelClienteFormPage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://example.test",
      },
      confirm: vi.fn(() => true),
    });
  });

  it("renderiza a tela de editar com formulario de data e acoes do historico", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelClienteFormPage, {
        mode: "edit",
        typeOptions: [{ id: 4, name: "Escola" }],
        client,
      }),
    );

    expect(html).toContain("Adicionar data de passeio");
    expect(html).toContain("Data do Passeio");
    expect(html).toContain('type="date"');
    expect(html).toContain("Acoes");
    expect(html).toContain("Inativar");
    expect(html).toContain("Remover");
    expect(html).toContain("Estrutura Escolar");
  });
});
