import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PainelConvenioImportPage } from "@/components/painel-convenio-import-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("PainelConvenioImportPage", () => {
  it("renderiza o upload inicial e o link do modelo csv", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelConvenioImportPage, {
        agreementId: 7,
        agreementName: "Convenio Alfa",
        completed: false,
        initialStage: null,
      }),
    );

    expect(html).toContain("Importar Candidatos");
    expect(html).toContain("Selecione o arquivo para importacao");
    expect(html).toContain("Modelo de arquivo (CSV)");
  });

  it("renderiza o preview staged da importacao", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelConvenioImportPage, {
        agreementId: 7,
        agreementName: "Convenio Alfa",
        completed: false,
        initialStage: {
          importId: "abc",
          agreementId: 7,
          csvText: "csv",
          reason: null,
          createdAt: "2026-05-08T12:00:00.000Z",
          preview: {
            agreementId: 7,
            agreementName: "Convenio Alfa",
            totalRows: 3,
            validRows: 2,
            invalidRows: 1,
            log: "Linha 3: erro",
            rows: [],
          },
        },
      }),
    );

    expect(html).toContain("Leitura do Arquivo CSV finalizada.");
    expect(html).toContain("Continuar Importacao");
    expect(html).toContain("Cancelar Importacao");
    expect(html).toContain("Download");
  });
});
