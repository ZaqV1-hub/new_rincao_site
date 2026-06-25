import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPainelConvenioImport,
  buildConvenioImportTemplateCsv,
  cancelPainelConvenioImport,
  getPainelConvenioImportLog,
  getPainelConvenioImportState,
  stagePainelConvenioImport,
} from "@/lib/painel-convenio-import";

const mocks = vi.hoisted(() => ({
  previewAgreementMembersImport: vi.fn(),
  applyAgreementMembersImport: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("@/lib/ops-agreement-members", () => ({
  applyAgreementMembersImport: mocks.applyAgreementMembersImport,
  previewAgreementMembersImport: mocks.previewAgreementMembersImport,
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mocks.mkdir,
  readFile: mocks.readFile,
  rm: mocks.rm,
  writeFile: mocks.writeFile,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildConvenioImportTemplateCsv", () => {
  it("returns the legacy csv header", () => {
    expect(buildConvenioImportTemplateCsv()).toContain(
      "CPF;QTD. COMPRA POR DIA;DATA INICIO;DATA FIM;STATUS",
    );
  });
});

describe("stagePainelConvenioImport", () => {
  it("persists preview state for later apply/cancel", async () => {
    mocks.previewAgreementMembersImport.mockResolvedValue({
      agreementId: 7,
      agreementName: "Convenio Alfa",
      totalRows: 2,
      validRows: 1,
      invalidRows: 1,
      log: "Linha 2: erro",
      rows: [],
    });

    const stage = await stagePainelConvenioImport({
      agreementId: 7,
      csvText: "CPF;QTD. COMPRA POR DIA;DATA INICIO;DATA FIM;STATUS\n1;1;01/01/2026;02/01/2026;Ativo",
    });

    expect(stage.agreementId).toBe(7);
    expect(mocks.writeFile).toHaveBeenCalled();
  });
});

describe("staged import operations", () => {
  it("loads, applies, cancels, and serves the staged log", async () => {
    mocks.readFile.mockResolvedValue(
      JSON.stringify({
        importId: "abc",
        agreementId: 7,
        csvText: "csv",
        preview: {
          log: "Linha 2: erro",
        },
        reason: null,
        createdAt: "2026-05-08T00:00:00.000Z",
      }),
    );
    mocks.applyAgreementMembersImport.mockResolvedValue({ created: 1, updated: 0 });

    await expect(
      getPainelConvenioImportState({ agreementId: 7, importId: "abc" }),
    ).resolves.toMatchObject({ importId: "abc" });
    await expect(
      getPainelConvenioImportLog({ agreementId: 7, importId: "abc" }),
    ).resolves.toBe("Linha 2: erro");
    await expect(
      applyPainelConvenioImport({ agreementId: 7, importId: "abc" }),
    ).resolves.toMatchObject({ importId: "abc" });
    await expect(
      cancelPainelConvenioImport({ agreementId: 7, importId: "abc" }),
    ).resolves.toMatchObject({ importId: "abc" });

    expect(mocks.rm).toHaveBeenCalled();
  });
});
