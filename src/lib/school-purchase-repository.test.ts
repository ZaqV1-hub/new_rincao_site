import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSchoolPurchase,
  searchSchoolsByName,
} from "@/lib/school-purchase-repository";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  generateUniqueVoucherNumber: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
    connect: async () => ({
      query: mocks.clientQuery,
      release: mocks.release,
    }),
  }),
  getIngressoSistemaDbPool: () => ({
    query: mocks.query,
    connect: async () => ({
      query: mocks.clientQuery,
      release: mocks.release,
    }),
  }),
}));

vi.mock("@/lib/voucher-number", () => ({
  generateUniqueVoucherNumber: mocks.generateUniqueVoucherNumber,
}));

describe("school-purchase-repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateUniqueVoucherNumber.mockResolvedValue("ESC-0001");
  });

  it("creates an educator purchase using the shared school purchase flow", async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          idagenda: 77,
          dtagenda: "2026-06-15",
          school_name: "Escola Rincao",
        },
      ],
    });
    mocks.clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("information_schema.columns") && sql.includes("tipo_escola")) {
        return { rows: [{ exists: true }] };
      }

      if (sql.includes("ADD COLUMN IF NOT EXISTS diretoria_ensino")) {
        return { rows: [] };
      }

      if (sql.includes("SELECT") && sql.includes("FROM agenda") && sql.includes("c.tipo_escola")) {
        return {
          rows: [
            {
              idagenda: 77,
              dtagenda: "2026-06-15",
              school_name: "Escola Rincao",
              school_type: null,
            },
          ],
        };
      }

      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO compra")) {
        expect(values).toEqual(["52998224725", "45.00"]);
        return {
          rows: [{ idcompra: 901 }],
        };
      }

      if (sql.includes("INSERT INTO voucher")) {
        expect(sql).toContain("nomeeducador");
        expect(sql).toContain("funcaoeducador");
        expect(values).toEqual([
          901,
          "ESC-0001",
          77,
          "45.00",
          12,
          "educador",
          "Carlos Lima",
          "Professor",
          "2026-06-15",
        ]);

        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      createSchoolPurchase("52998224725", {
        schoolId: 12,
        agendaId: 77,
        value: "45,00",
        participantType: "educator",
        educatorName: "Carlos Lima",
        educatorRole: "Professor",
      } as never),
    ).resolves.toEqual({
      purchaseId: 901,
      legacyEncodedId: "OTAx",
      totalValue: "45.00",
      voucherCount: 1,
    });
  });

  it("returns only schools with an open trip date from today onwards and their address", async () => {
    mocks.query.mockResolvedValue({
      rows: [{ id: 12, name: "PAULINO EMEF", address: "Rua das Flores, 123" }],
    });

    await expect(searchSchoolsByName("Pauli")).resolves.toEqual([
      { id: 12, name: "PAULINO EMEF", address: "Rua das Flores, 123" },
    ]);

    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("a.dtagenda >= CURRENT_DATE"),
      ["%Pauli%"],
    );
    expect(mocks.query.mock.calls[0][0]).toContain("ae.stagenda_cli = 'abe'");
  });
});
