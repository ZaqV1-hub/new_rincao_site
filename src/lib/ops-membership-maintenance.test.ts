import { beforeEach, describe, expect, it, vi } from "vitest";
import { runMembershipMaintenance } from "@/lib/ops-membership-maintenance";

const { query, connect, release } = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect,
  }),
}));

describe("ops-membership-maintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({
      query,
      release,
    });
  });

  it("deactivates expired socios, convenios and conveniados", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("UPDATE socio")) {
        return { rows: [{ total: "2" }] };
      }

      if (sql.includes("UPDATE convenio")) {
        return { rows: [{ total: "1" }] };
      }

      if (sql.includes("UPDATE conveniado")) {
        return { rows: [{ total: "3" }] };
      }

      return { rows: [{ total: "0" }] };
    });

    await expect(runMembershipMaintenance()).resolves.toEqual({
      action: "membership_maintenance",
      processed: 6,
      items: [
        { domain: "socio", deactivated: 2 },
        { domain: "convenio", deactivated: 1 },
        { domain: "conveniado", deactivated: 3 },
      ],
      message: "6 registro(s) inativados por vigencia.",
    });
  });
});
