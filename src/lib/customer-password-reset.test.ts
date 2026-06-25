import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCustomerPasswordResetTicket,
  requestCustomerPasswordReset,
  resetCustomerPassword,
} from "@/lib/customer-password-reset";

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

describe("customer-password-reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests a public password reset by cpf and queues the legacy email", async () => {
    mocks.query.mockImplementation(async (sql: string, values?: unknown[]) => {
      if (sql.includes("SELECT (dtemail::timestamp + hremail) AS sent_at")) {
        expect(values?.[0]).toBe("cliente@example.com");
        return { rows: [] };
      }

      if (sql.includes("FROM usuario") && sql.includes("WHERE cpf = $1")) {
        expect(values).toEqual(["52998224725"]);
        return {
          rows: [
            {
              cpf: "52998224725",
              nmusuario: "Cliente Teste",
              email: "cliente@example.com",
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
      requestCustomerPasswordReset({
        cpf: "52998224725",
        origin: "https://example.com",
      }),
    ).resolves.toEqual({
      blocked: false,
      userFound: true,
      email: "cliente@example.com",
    });
    expect(mocks.queueLegacyEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "cliente@example.com",
        toName: "Cliente Teste",
        subject: "Estancia - Recuperacao de Senha",
        html: expect.stringContaining("/login/trocar-senha/ticket/"),
      }),
    );
  });

  it("blocks public password reset when the throttle window is still active", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM usuario") && sql.includes("WHERE cpf = $1")) {
        return {
          rows: [
            {
              cpf: "52998224725",
              nmusuario: "Cliente Teste",
              email: "cliente@example.com",
            },
          ],
        };
      }

      if (sql.includes("SELECT (dtemail::timestamp + hremail) AS sent_at")) {
        return {
          rows: [{ sent_at: new Date().toISOString() }],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(
      requestCustomerPasswordReset({
        cpf: "52998224725",
        origin: "https://example.com",
      }),
    ).resolves.toMatchObject({
      blocked: true,
      message: expect.stringContaining("Aguarde"),
    });
    expect(mocks.queueLegacyEmail).not.toHaveBeenCalled();
  });

  it("reports whether the public reset ticket is valid", async () => {
    mocks.query.mockResolvedValue({
      rows: [{ cpf: "52998224725", flusado: "n" }],
    });

    await expect(getCustomerPasswordResetTicket("abc")).resolves.toEqual({
      exists: true,
      valid: true,
      cpf: "52998224725",
    });
  });

  it("resets the public password and marks the ticket as used", async () => {
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
      resetCustomerPassword({
        ticket: "abc",
        password: "nova-senha",
      }),
    ).resolves.toEqual({
      ok: true,
    });
    expect(mocks.release).toHaveBeenCalled();
  });
});
