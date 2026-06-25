import { beforeEach, describe, expect, it, vi } from "vitest";
import { addPainelClientTripDate } from "@/lib/painel-clientes";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect: mocks.connect,
  }),
}));

describe("painel-clientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue({
      query: mocks.clientQuery,
      release: mocks.release,
    });
  });

  it("insere aceita_familia como boolean ao adicionar data de passeio", async () => {
    const futureDate = new Date();
    futureDate.setHours(12, 0, 0, 0);
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateBr = [
      String(futureDate.getDate()).padStart(2, "0"),
      String(futureDate.getMonth() + 1).padStart(2, "0"),
      String(futureDate.getFullYear()),
    ].join("/");
    const futureDateYmd = [
      String(futureDate.getFullYear()),
      String(futureDate.getMonth() + 1).padStart(2, "0"),
      String(futureDate.getDate()).padStart(2, "0"),
    ].join("-");

    mocks.clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (
        sql.includes("information_schema.tables") &&
        Array.isArray(values) &&
        values[0] === "agenda_faixas"
      ) {
        return { rows: [{ exists: true }] };
      }

      if (
        sql.includes("information_schema.columns") &&
        Array.isArray(values) &&
        values[0] === "agenda_faixas" &&
        values[1] === "idcliente"
      ) {
        return { rows: [{ exists: true }] };
      }

      if (
        sql.includes("information_schema.columns") &&
        Array.isArray(values) &&
        values[0] === "agenda" &&
        (values[1] === "dtualt" || values[1] === "hrualt")
      ) {
        return { rows: [{ exists: true }] };
      }

      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("SELECT idagenda") && sql.includes("FROM agenda") && sql.includes("WHERE dtagenda = $1")) {
        return { rows: [] };
      }

      if (sql.includes("JOIN agenda_extras ae") && sql.includes("WHERE ae.idcliente = $1")) {
        return { rows: [] };
      }

      if (sql.includes("SELECT tpagenda, idtabpreco, idinformacao")) {
        return {
          rows: [{ tpagenda: "escol", idtabpreco: 5, idinformacao: 2 }],
        };
      }

      if (sql.includes("INSERT INTO agenda (")) {
        expect(values).toEqual([futureDateYmd, "escol", 5, 2]);
        return { rows: [{ idagenda: 777 }] };
      }

      if (sql.includes("FROM agenda_extras") && sql.includes("WHERE idagenda = $1") && sql.includes("idcliente = $2")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO agenda_extras")) {
        expect(values?.[0]).toBe(777);
        expect(values?.[1]).toBe(4658);
        expect(values?.[2]).toBe(false);
        return { rows: [] };
      }

      if (sql.includes("SELECT COUNT(*) AS total") && sql.includes("FROM agenda_faixas")) {
        return { rows: [{ total: 0 }] };
      }

      if (sql.includes("SELECT ae.idagenda") && sql.includes("ORDER BY ae.idagenda DESC")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO agenda_faixas")) {
        return { rows: [] };
      }

      if (sql.includes("UPDATE agenda") && sql.includes("SET dtualt = CURRENT_DATE, hrualt = CURRENT_TIME")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      addPainelClientTripDate({
        clientId: 4658,
        values: { datapasseio: futureDateBr },
      }),
    ).resolves.toMatchObject({
      clientId: 4658,
      agendaId: 777,
    });
  });
});
