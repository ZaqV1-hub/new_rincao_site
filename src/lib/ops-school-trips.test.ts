import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOpsSchoolTripDate,
  getOpsSchoolTripsScreenData,
  updateOpsSchoolTripDateStatus,
} from "@/lib/ops-school-trips";

const { query, connect, release, registerOpsAuditLog } = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
  registerOpsAuditLog: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect,
  }),
}));

vi.mock("@/lib/ops-audit-log", () => ({
  registerOpsAuditLog,
}));

describe("ops-school-trips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({
      query,
      release,
    });
    registerOpsAuditLog.mockResolvedValue(701);
  });

  it("loads a selected school with its trip dates", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("FROM escola") && sql.includes("WHERE escola.idescola = $1")) {
        expect(values).toEqual([12]);
        return {
          rows: [
            {
              idescola: 12,
              nmescola: "Escola Estancia",
              stescola: "ati",
              idinformacao: 8,
            },
          ],
        };
      }

      if (sql.includes("FROM escoladata") && sql.includes("JOIN agenda")) {
        return {
          rows: [
            {
              idagenda: 77,
              dtagenda: "2026-06-15",
              dtagenda_fmt: "15/06/2026",
              status: "ati",
              codescoladata: "ABC123",
              permalink: "plink1",
            },
            {
              idagenda: 78,
              dtagenda: "2026-06-22",
              dtagenda_fmt: "22/06/2026",
              status: "ina",
              codescoladata: "DEF456",
              permalink: "plink2",
            },
          ],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      getOpsSchoolTripsScreenData({ schoolId: 12 }),
    ).resolves.toMatchObject({
      search: {
        query: "",
      },
      selectedSchool: {
        schoolId: 12,
        name: "Escola Estancia",
        status: "ati",
        trips: [
          {
            agendaId: 77,
            date: "2026-06-15",
            dateLabel: "15/06/2026",
            status: "ati",
            statusLabel: "Ativa",
            code: "ABC123",
          },
          {
            agendaId: 78,
            status: "ina",
            statusLabel: "Inativa",
          },
        ],
      },
    });
  });

  it("creates a new trip date using an existing school agenda", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("FROM escola") && sql.includes("WHERE escola.idescola = $1")) {
        return {
          rows: [
            {
              idescola: 12,
              nmescola: "Escola Estancia",
              stescola: "ati",
              idinformacao: 8,
            },
          ],
        };
      }

      if (sql.includes("FROM agenda") && sql.includes("WHERE agenda.dtagenda = $1")) {
        expect(values).toEqual(["2026-06-15"]);
        return {
          rows: [
            {
              idagenda: 77,
            },
          ],
        };
      }

      if (sql.includes("FROM escoladata") && sql.includes("WHERE idescola = $1 AND idagenda = $2")) {
        expect(values).toEqual([12, 77]);
        return {
          rows: [],
        };
      }

      if (sql.includes("INSERT INTO escoladata")) {
        expect(values?.[0]).toBe(12);
        expect(values?.[1]).toBe(77);
        expect(values?.[2]).toBe("ati");
        return {
          rows: [],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      createOpsSchoolTripDate(
        {
          schoolId: 12,
          visitDate: "15/06/2026",
          actor: {
            name: "Operador",
          },
        },
      ),
    ).resolves.toMatchObject({
      schoolId: 12,
      agendaId: 77,
      auditLogId: 701,
      message: "Data de passeio vinculada com sucesso.",
    });
  });

  it("updates the active status of a school trip date", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("FROM escoladata") && sql.includes("WHERE idescola = $1 AND idagenda = $2")) {
        expect(values).toEqual([12, 77]);
        return {
          rows: [
            {
              idescola: 12,
              idagenda: 77,
              status: "ati",
            },
          ],
        };
      }

      if (sql.includes("UPDATE escoladata")) {
        expect(values).toEqual(["ina", 12, 77]);
        return {
          rows: [],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      updateOpsSchoolTripDateStatus({
        schoolId: 12,
        agendaId: 77,
        status: "ina",
      }),
    ).resolves.toMatchObject({
      schoolId: 12,
      agendaId: 77,
      status: "ina",
      auditLogId: 701,
      message: "Status da data atualizado com sucesso.",
    });
  });
});
