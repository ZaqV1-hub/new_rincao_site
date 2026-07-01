import { beforeEach, describe, expect, it, vi } from "vitest";
import { queueLegacyEmail } from "@/lib/legacy-email";

const mocks = vi.hoisted(() => ({
  legacyQuery: vi.fn(),
  sendMail: vi.fn(),
  systemQuery: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  createTransport: vi.fn(() => ({
    sendMail: mocks.sendMail,
  })),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.legacyQuery,
  }),
  getIngressoSistemaDbPool: () => ({
    query: mocks.systemQuery,
  }),
}));

describe("legacy-email queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PASSWORD_RESET_SEND_SYNC = "false";
    process.env.EMAIL_SMTP_USERNAME = "ingressos@cluberincao.com.br";
    process.env.EMAIL_SMTP_PASSWORD = "senha-teste";
    mocks.systemQuery.mockResolvedValue({ rows: [{ idemail: 123 }] });
    mocks.sendMail.mockResolvedValue({ messageId: "abc" });
  });

  it("queues email through the sistema database", async () => {
    await expect(
      queueLegacyEmail({
        to: "cliente@example.com",
        toName: "Cliente",
        subject: "Teste",
        html: "<p>Teste</p>",
      }),
    ).resolves.toBe(123);

    expect(mocks.systemQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO email"),
      expect.arrayContaining(["cliente@example.com", "Cliente", "Teste"]),
    );
    expect(mocks.legacyQuery).not.toHaveBeenCalled();
  });

  it("sends queued email synchronously when PASSWORD_RESET_SEND_SYNC is true", async () => {
    process.env.PASSWORD_RESET_SEND_SYNC = "true";

    await expect(
      queueLegacyEmail({
        to: "cliente@example.com",
        toName: "Cliente",
        subject: "Teste",
        html: "<p>Teste</p>",
      }),
    ).resolves.toBe(123);

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "\"Cliente\" <cliente@example.com>",
        subject: "Teste",
        html: "<p>Teste</p>",
      }),
    );
    expect(mocks.systemQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE email"),
      [123],
    );
  });

  it("fails the queue operation when synchronous SMTP delivery fails", async () => {
    process.env.PASSWORD_RESET_SEND_SYNC = "true";
    const smtpError = Object.assign(new Error("Authentication failed"), {
      code: "EAUTH",
    });
    mocks.sendMail.mockRejectedValue(smtpError);

    await expect(
      queueLegacyEmail({
        to: "cliente@example.com",
        toName: "Cliente",
        subject: "Teste",
        html: "<p>Teste</p>",
      }),
    ).rejects.toThrow("Authentication failed");

    expect(mocks.systemQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE email"),
      [123, 1],
    );
  });
});
