import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPainelConvenioMemberDetail,
  listPainelConvenioMembers,
  normalizePainelConvenioMembersFilters,
  validateConveniadoActivation,
  validatePainelConvenioMemberForm,
} from "@/lib/painel-convenio-members";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizePainelConvenioMembersFilters", () => {
  it("normalizes cpf, status, period, and pagination", () => {
    const filters = normalizePainelConvenioMembersFilters(7, {
      cpf: "123.456.789-01",
      stconveniado: "ati",
      "periodo[de]": "01/05/2026",
      "periodo[ate]": "31/05/2026",
      page: "2",
      pp: "10",
    });

    expect(filters).toEqual({
      cpf: "12345678901",
      status: "ati",
      periodFrom: "01/05/2026",
      periodTo: "31/05/2026",
      page: 2,
      perPage: 10,
    });
  });
});

describe("validatePainelConvenioMemberForm", () => {
  it("rejects invalid cpf", () => {
    expect(() =>
      validatePainelConvenioMemberForm({
        cpf: "123",
        qtcompradia: "2",
        dtiniado: "08/05/2026",
        dtfimado: "10/05/2026",
      }),
    ).toThrow(/cpf/i);
  });
});

describe("validateConveniadoActivation", () => {
  it("rejects expired member reactivation", () => {
    expect(() =>
      validateConveniadoActivation({
        status: "ati",
        endDate: "2026-05-01",
        today: "2026-05-08",
      }),
    ).toThrow(/vigencia invalida/i);
  });
});

describe("listPainelConvenioMembers", () => {
  it("returns paginated legacy rows", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT idconvenio, nmconvenio") && sql.includes("FROM convenio")) {
        return { rows: [{ idconvenio: 7, nmconvenio: "Convenio Alfa" }] };
      }

      if (sql.includes("SELECT") && sql.includes("FROM conveniado") && sql.includes("LIMIT")) {
        return {
          rows: [
            {
              idconvenio: 7,
              nmconvenio: "Convenio Alfa",
              cpf: "12345678901",
              qtcompradia: 2,
              dtiniado: "2026-05-01",
              dtfimado: "2026-05-31",
              stconveniado: "ati",
              nmusuario: "Joao Silva",
            },
          ],
        };
      }

      if (sql.includes("COUNT(*)::text AS total")) {
        return { rows: [{ total: "1" }] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await listPainelConvenioMembers({
      agreementId: 7,
      filters: {},
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      cpf: "12345678901",
      cpfLabel: "123.456.789-01",
      userName: "Joao Silva",
      statusLabel: "Ativo",
    });
  });
});

describe("getPainelConvenioMemberDetail", () => {
  it("returns member and user profile blocks", async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          idconvenio: 7,
          nmconvenio: "Convenio Alfa",
          cpf: "12345678901",
          qtcompradia: 2,
          dtiniado: "2026-05-01",
          dtfimado: "2026-05-31",
          stconveniado: "ati",
          dtcadastro: "2026-05-06",
          nmusuario: "Joao Silva",
          rg: "1234567",
          dtnascimento: "1990-01-02",
          sexo: "mas",
          email: "joao@example.test",
          telefone: "1133334444",
          celular: "11999999999",
          endereco: "Rua A, 10",
          cep: "01000-000",
          bairro: "Centro",
          nmcidade: "Sao Paulo",
          uf: "SP",
          complemento: "Casa",
          stusuario: "ati",
          dtcadastro_usuario: "2025-01-01",
          dtulogin: "2026-05-07",
          hrulogin: "10:30:00",
        },
      ],
    });

    const result = await getPainelConvenioMemberDetail({
      agreementId: 7,
      memberId: "12345678901",
    });

    expect(result).toMatchObject({
      agreementId: 7,
      cpfLabel: "123.456.789-01",
      userName: "Joao Silva",
      cityLabel: "Sao Paulo - SP",
      userStatusLabel: "Ativo",
    });
  });
});
