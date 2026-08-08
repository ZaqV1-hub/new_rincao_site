import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmSchoolContract,
  createSchoolContract,
  getSchoolContractApproval,
} from "@/lib/school-contracts";

const { connect, query, release, queueLegacyEmail } = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  release: vi.fn(),
  queueLegacyEmail: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbPool: () => ({
    connect,
  }),
}));

vi.mock("@/lib/legacy-email", () => ({
  queueLegacyEmail,
}));

describe("school-contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({
      query,
      release,
    });
    queueLegacyEmail.mockResolvedValue(10);
  });

  it("creates a pending contract and sends invite emails", async () => {
    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (
        sql === "BEGIN" ||
        sql === "COMMIT" ||
        sql.includes("CREATE TABLE IF NOT EXISTS") ||
        sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS") ||
        sql.includes("UPDATE contrato_escolar_agendamento")
      ) {
        return { rows: [] };
      }

      if (sql.includes("FROM escola") && sql.includes("WHERE escola.idescola = $1")) {
        expect(values).toEqual([12]);
        return {
          rows: [
            {
              idescola: 12,
              nmescola: "Escola Rincao",
              stescola: "ati",
              idcliente: 44,
            },
          ],
        };
      }

      if (sql.includes("FROM contrato_escolar_representante")) {
        return {
          rows: [
            {
              idrepresentante: 5,
              escola_id: 12,
              nome: "Maria Escola",
              email: "maria@escola.test",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO contrato_escolar_agendamento")) {
        expect(values?.[0]).toBe(12);
        expect(values?.[1]).toBe(44);
        expect(values?.[2]).toBe("2026-09-10");
        expect(values?.[7]).toBe("Responsavel");
        expect(values?.[9]).toBe("resp@escola.test");
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await createSchoolContract({
      schoolId: 12,
      visitDate: "2026-09-10",
      representativeId: 5,
      responsibleName: "Responsavel",
      responsiblePhone: "11999999999",
      responsibleEmail: "resp@escola.test",
      baseUrl: "https://cluberincao.test",
      actor: { name: "Operador" },
    });

    expect(result.approvalPath).toMatch(/^\/contrato\/aprovacao\/.+/);
    expect(result.approvalUrl).toContain("https://cluberincao.test/contrato/aprovacao/");
    expect(queueLegacyEmail).toHaveBeenCalledTimes(2);
  });

  it("loads an approval contract by token", async () => {
    const token = "11111111-1111-4111-8111-111111111111";

    query.mockImplementation(async (sql: string) => {
      if (
        sql.includes("CREATE TABLE IF NOT EXISTS") ||
        sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS")
      ) {
        return { rows: [] };
      }

      if (sql.includes("FROM contrato_escolar_agendamento contrato")) {
        return {
          rows: [
            {
              idcontrato: 1,
              escola_id: 12,
              escola_nome: "Escola Rincao",
              cliente_id: 44,
              data_passeio: "2026-09-10",
              data_passeio_fmt: "10/09/2026",
              representante_id: 5,
              representante_nome: "Maria Escola",
              representante_email: "maria@escola.test",
              observacao: null,
              responsavel_nome: "Responsavel",
              responsavel_telefone: "11999999999",
              responsavel_email: "resp@escola.test",
              status: "aguardando_confirmacao",
              token,
              token_expira_em: "2099-01-01 00:00:00",
              token_usado_em: null,
              token_invalido_em: null,
              nome_confirmante: null,
              cargo_confirmante: null,
              confirmado_em: null,
              confirmado_em_fmt: null,
              ip_confirmacao: null,
              agenda_id: null,
              criado_em: "2026-08-08 12:00:00",
            },
          ],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(getSchoolContractApproval(token)).resolves.toMatchObject({
      status: "ready",
      schoolName: "Escola Rincao",
      visitDateLabel: "10/09/2026",
    });
  });

  it("confirms a contract and creates the school trip binding", async () => {
    const token = "11111111-1111-4111-8111-111111111111";

    query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (
        sql === "BEGIN" ||
        sql === "COMMIT" ||
        sql.includes("CREATE TABLE IF NOT EXISTS") ||
        sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS")
      ) {
        return { rows: [] };
      }

      if (sql.includes("FROM contrato_escolar_agendamento contrato")) {
        return {
          rows: [
            {
              idcontrato: 1,
              escola_id: 12,
              escola_nome: "Escola Rincao",
              cliente_id: 44,
              data_passeio: "2026-09-10",
              data_passeio_fmt: "10/09/2026",
              representante_id: 5,
              representante_nome: "Maria Escola",
              representante_email: "maria@escola.test",
              observacao: null,
              responsavel_nome: "Responsavel",
              responsavel_telefone: "11999999999",
              responsavel_email: "resp@escola.test",
              status: "aguardando_confirmacao",
              token,
              token_expira_em: "2099-01-01 00:00:00",
              token_usado_em: null,
              token_invalido_em: null,
              nome_confirmante: null,
              cargo_confirmante: null,
              confirmado_em: null,
              confirmado_em_fmt: null,
              ip_confirmacao: null,
              agenda_id: null,
              criado_em: "2026-08-08 12:00:00",
            },
          ],
        };
      }

      if (sql.includes("FROM agenda") && sql.includes("WHERE dtagenda = $1")) {
        return { rows: [{ idagenda: 77 }] };
      }

      if (sql.includes("FROM escoladata")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO escoladata")) {
        expect(values?.[0]).toBe(12);
        expect(values?.[1]).toBe(77);
        return { rows: [] };
      }

      if (sql.includes("FROM agenda_extras")) {
        return { rows: [] };
      }

      if (sql.includes("INSERT INTO agenda_extras")) {
        expect(values?.[0]).toBe(77);
        expect(values?.[1]).toBe(44);
        return { rows: [] };
      }

      if (sql.includes("UPDATE contrato_escolar_agendamento")) {
        expect(values?.[0]).toBe(token);
        expect(values?.[1]).toBe(77);
        expect(values?.[2]).toBe("Diretora");
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      confirmSchoolContract({
        token,
        confirmerName: "Diretora",
        confirmerRole: "Direcao",
        ipAddress: "127.0.0.1",
      }),
    ).resolves.toMatchObject({
      token,
      agendaId: 77,
      message: "Passeio agendado com sucesso.",
    });
    expect(queueLegacyEmail).toHaveBeenCalledTimes(3);
  });
});
