import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelClientTripDetailPage } from "@/components/painel-client-trip-detail-page";
import { getSchoolEducationStructure } from "@/lib/school-education";
import type { PainelClientTripDetailData } from "@/lib/painel-client-trip-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const schoolData: PainelClientTripDetailData = {
  trip: {
    agendaId: 77,
    clientId: 248,
    clientName: "ABRAHAO DE MORAES PROF. E.E.",
    clientTypeName: "Escola",
    clientTypeId: 4,
    date: "2026-05-10",
    dateLabel: "10/05/2026",
    code: "ABC123",
    slug: "abc123slug",
    agendaType: "escol",
    agendaTypeLabel: "Escolar",
    agendaStatus: "abe",
    agendaStatusLabel: "Aberta",
    acceptsFamily: false,
    uiStatus: "ati",
    uiStatusLabel: "Ativo",
    nextUiStatus: "ina",
    nextUiStatusLabel: "Inativo",
    purchaseLink: "/ingresso/cliente/escola/abc123slug",
  },
  filters: {
    purchaseStatus: "",
  },
  statusOptions: [
    { value: "", label: "Todos" },
    { value: "conc", label: "Concluida" },
  ],
  indicators: {
    paidCount: 1,
    unpaidCount: 0,
    usedCount: 0,
    unusedCount: 1,
    paidValue: "49.90",
    unpaidValue: "0.00",
    usedValue: "0.00",
    unusedValue: "49.90",
    totalCount: 1,
    totalValue: "49.90",
  },
  isSchool: true,
  educationStructure: getSchoolEducationStructure(),
  schools: [{ clientId: 248, name: "ABRAHAO DE MORAES PROF. E.E." }],
  students: [
    {
      purchaseId: 901,
      voucherId: 1001,
      voucherNumber: "VCH-1",
      name: "Ana Souza",
      role: "",
      educationType: "fund1",
      educationYear: "3",
      classLetter: "B",
      classDisplay: "Ensino Fundamental I - 3o ano - B",
      unitValue: "49.90",
      purchaseDate: "2026-05-01",
      purchaseDateLabel: "01/05/2026 10:00",
      paymentDate: "2026-05-01",
      paymentDateLabel: "01/05/2026 10:05",
      used: false,
      usedLabel: "Nao",
      usedDate: null,
      usedDateLabel: "-",
      purchaseStatus: "conc",
      purchaseStatusLabel: "Concluida",
      schoolId: 248,
      agendaId: 77,
    },
  ],
  educators: [
    {
      purchaseId: 901,
      voucherId: 1002,
      voucherNumber: "VCH-2",
      name: "Carlos Lima",
      role: "Professor",
      educationType: "",
      educationYear: "",
      classLetter: "",
      classDisplay: "",
      unitValue: "0.00",
      purchaseDate: "2026-05-01",
      purchaseDateLabel: "01/05/2026 10:00",
      paymentDate: "2026-05-01",
      paymentDateLabel: "01/05/2026 10:05",
      used: true,
      usedLabel: "Sim",
      usedDate: "2026-05-10",
      usedDateLabel: "10/05/2026 08:30",
      purchaseStatus: "conc",
      purchaseStatusLabel: "Concluida",
      schoolId: 248,
      agendaId: 77,
    },
  ],
  genericParticipants: [
    {
      purchaseId: 901,
      voucherId: 1001,
      voucherNumber: "VCH-1",
      name: "Ana Souza",
      role: "",
      educationType: "fund1",
      educationYear: "3",
      classLetter: "B",
      classDisplay: "Ensino Fundamental I - 3o ano - B",
      unitValue: "49.90",
      purchaseDate: "2026-05-01",
      purchaseDateLabel: "01/05/2026 10:00",
      paymentDate: "2026-05-01",
      paymentDateLabel: "01/05/2026 10:05",
      used: false,
      usedLabel: "Nao",
      usedDate: null,
      usedDateLabel: "-",
      purchaseStatus: "conc",
      purchaseStatusLabel: "Concluida",
      schoolId: 248,
      agendaId: 77,
    },
  ],
};

const genericData: PainelClientTripDetailData = {
  ...schoolData,
  trip: {
    ...schoolData.trip,
    clientTypeName: "Grupo misto",
    clientTypeId: 7,
  },
  isSchool: false,
  schools: [],
  students: [],
  genericParticipants: [],
};

describe("PainelClientTripDetailPage", () => {
  it("renderiza detalhe legado de passeio escolar", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelClientTripDetailPage, {
        data: schoolData,
        isManager: true,
      }),
    );

    expect(html).toContain("Dados do Passeio");
    expect(html).toContain("Codigo Passeio");
    expect(html).toContain("Relatorio de Ingressos");
    expect(html).toContain("Alunos");
    expect(html).toContain("Educadores");
    expect(html).toContain("Editar");
    expect(html).toContain("ABRAHAO DE MORAES PROF. E.E.");
    expect(html).toContain("ABC123");
  });

  it("renderiza tabela generica para cliente nao escolar", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelClientTripDetailPage, {
        data: genericData,
      }),
    );

    expect(html).toContain("Dados do Passeio");
    expect(html).toContain("Nenhum ingresso.");
    expect(html).not.toContain("Educadores");
  });
});
