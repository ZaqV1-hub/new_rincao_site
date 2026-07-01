import { beforeEach, describe, expect, it, vi } from "vitest";
import { queueLegacyEmail } from "@/lib/legacy-email";

const mocks = vi.hoisted(() => ({
  legacyQuery: vi.fn(),
  systemQuery: vi.fn(),
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
    mocks.systemQuery.mockResolvedValue({ rows: [{ idemail: 123 }] });
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
});
