import { describe, expect, it } from "vitest";
import {
  getPhase7ParityReport,
  summarizePhase7Parity,
} from "@/lib/ops-admin-parity";

describe("ops-admin-parity", () => {
  it("marks phase 7 ready once every mapped Zend action has a Next/BFF surface", () => {
    const report = getPhase7ParityReport(new Date("2026-04-25T12:00:00.000Z"));

    expect(report.phase).toBe(7);
    expect(report.generatedAt).toBe("2026-04-25T12:00:00.000Z");
    expect(report.summary.total).toBeGreaterThan(0);
    expect(report.summary.pending).toBe(0);
    expect(report.summary.writeCutoverReady).toBe(true);
    expect(report.domains.flatMap((domain) => domain.actions)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          legacyController: "AgendaController.php",
          status: "implemented",
        }),
      ]),
    );
    expect(report.blockers).toHaveLength(0);
    expect(report.domains.flatMap((domain) => domain.actions)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          legacyController: "ClientesController.php",
          capability: "Passeios, links, alunos e relatorios de clientes",
          status: "implemented",
        }),
        expect.objectContaining({
          legacyController: "BilheteriaController.php",
          capability: "Edicao auditavel de venda historica",
          status: "implemented",
        }),
        expect.objectContaining({
          legacyController: "CategoriasController.php",
          capability: "CRUD administrativo de tipos de desconto",
          status: "implemented",
        }),
      ]),
    );
  });

  it("marks cutover ready only when every action is closed", () => {
    const summary = summarizePhase7Parity([
      {
        domain: "Teste",
        criticality: "critical",
        actions: [
          {
            legacyController: "A.php",
            legacyAction: "indexAction",
            capability: "A",
            status: "implemented",
            nextSurface: "/api/ops/admin/a",
            evidence: "teste",
          },
          {
            legacyController: "B.php",
            legacyAction: "indexAction",
            capability: "B",
            status: "deprecated",
            nextSurface: null,
            evidence: "depreciado com aceite",
          },
        ],
      },
    ]);

    expect(summary).toEqual({
      total: 2,
      implemented: 1,
      validated: 0,
      pending: 0,
      deprecated: 1,
      completionPercent: 100,
      writeCutoverReady: true,
    });
  });
});
