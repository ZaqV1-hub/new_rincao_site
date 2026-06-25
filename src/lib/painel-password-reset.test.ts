import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPainelPasswordResetTicket,
  requestPainelPasswordReset,
  resetPainelPassword,
} from "@/lib/painel-password-reset";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
  queueLegacyEmail: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
    connect: async () => ({
      query: mocks.clientQuery,
      release: mocks.release,
    }),
  }),
}));

vi.mock("@/lib/legacy-email", () => ({
  queueLegacyEmail: mocks.queueLegacyEmail,
}));

describe("painel-password-reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests a panel password reset by email and queues the legacy email", async () => {
    mocks.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("SELECT (dtemail::timestamp + hremail) AS sent_at")) {
        expect(values?.[0]).toBe("gestor@example.com");
        return { rows: [] };
      }

      if (sql.includes("FROM usuario") && sql.includes("LOWER(email) = LOWER($1)")) {
        expect(values).toEqual(["gestor@example.com"]);
        return {
          rows: [
            {
              cpf: "52998224725",
              nmusuario: "Gestor Teste",
              email: "gestor@example.com",
              idpapel: 1,
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO trocasenha")) {
        expect(values?.[0]).toBe("52998224725");
        expect(typeof values?.[1]).toBe("string");
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      requestPainelPasswordReset({
        email: "GESTOR@example.com",
        origin: "https://example.com",
      }),
    ).resolves.toEqual({
      blocked: false,
      userFound: true,
      email: "gestor@example.com",
    });
    expect(mocks.queueLegacyEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "gestor@example.com",
        toName: "Gestor Teste",
        subject: "Estancia - Recuperacao de Senha",
        html: expect.stringContaining("/painel/login/trocar-senha/ticket/"),
      }),
    );
  });

  it("reports whether the panel reset ticket is valid", async () => {
    mocks.query.mockResolvedValue({
      rows: [{ cpf: "52998224725", flusado: "n" }],
    });

    await expect(getPainelPasswordResetTicket("abc")).resolves.toEqual({
      exists: true,
      valid: true,
      cpf: "52998224725",
    });
  });

  it("resets the panel password and marks the ticket as used", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT") {
        return { rows: [] };
      }

      if (sql.includes("FROM trocasenha") && sql.includes("FOR UPDATE")) {
        expect(values).toEqual(["abc"]);
        return {
          rows: [{ cpf: "52998224725", flusado: "n" }],
        };
      }

      if (sql.includes("UPDATE trocasenha")) {
        expect(values).toEqual(["abc"]);
        return { rows: [] };
      }

      if (sql.includes("UPDATE usuario")) {
        expect(values?.[0]).toMatch(/^[a-f0-9]{32}$/);
        expect(values?.[1]).toBe("52998224725");
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      resetPainelPassword({
        ticket: "abc",
        password: "nova-senha",
      }),
    ).resolves.toEqual({
      ok: true,
    });
    expect(mocks.release).toHaveBeenCalled();
  });
});
