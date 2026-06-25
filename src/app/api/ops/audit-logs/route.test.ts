import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateOperationsRequest = vi.fn();
const listOperationalAuditLogs = vi.fn();
const asOpsAuditHistoryError = vi.fn();

vi.mock("@/lib/ops-auth", () => ({
  authenticateOperationsRequest,
}));

vi.mock("@/lib/ops-audit-history", () => ({
  listOperationalAuditLogs,
  asOpsAuditHistoryError,
}));

describe("ops/audit-logs BFF route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateOperationsRequest.mockReturnValue({ ok: true });
    asOpsAuditHistoryError.mockImplementation((error: Error) => error);
  });

  it("returns paginated audit log items", async () => {
    listOperationalAuditLogs.mockResolvedValue({
      items: [
        {
          id: 901,
          origin: "compra",
          action: "editar",
          purchaseId: 321,
          description: "Valor alterado",
          reason: "Ajuste manual",
          userName: "Gestor Teste",
          details: { via: "apps/web" },
          createdAt: "2026-04-23 14:01:00+00",
        },
      ],
      meta: {
        limit: 10,
        offset: 0,
        total: 1,
        purchaseId: 321,
        voucherId: 9001,
        agendaId: 88,
      },
    });

    const { GET } = await import("@/app/api/ops/audit-logs/route");
    const response = await GET(
      new Request(
        "https://example.com/api/ops/audit-logs?purchaseId=321&voucherId=9001&agendaId=88&limit=10&offset=0",
        {
          headers: {
            authorization: "Bearer ops-token",
          },
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listOperationalAuditLogs).toHaveBeenCalledWith({
      purchaseId: 321,
      voucherId: 9001,
      agendaId: 88,
      limit: 10,
      offset: 0,
    });
    expect(body).toEqual({
      ok: true,
      data: {
        items: [
          {
            id: 901,
            origin: "compra",
            action: "editar",
            purchaseId: 321,
            description: "Valor alterado",
            reason: "Ajuste manual",
            userName: "Gestor Teste",
            details: { via: "apps/web" },
            createdAt: "2026-04-23 14:01:00+00",
          },
        ],
        meta: {
          limit: 10,
          offset: 0,
          total: 1,
          purchaseId: 321,
          voucherId: 9001,
          agendaId: 88,
        },
      },
    });
  });

  it("returns the normalized domain error", async () => {
    listOperationalAuditLogs.mockRejectedValue(
      Object.assign(new Error("bad request"), {
        code: "invalid_purchase_id",
        status: 400,
        message: "Informe um purchaseId valido para filtrar a auditoria.",
      }),
    );

    const { GET } = await import("@/app/api/ops/audit-logs/route");
    const response = await GET(
      new Request(
        "https://example.com/api/ops/audit-logs?purchaseId=-1",
        {
          headers: {
            authorization: "Bearer ops-token",
          },
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "invalid_purchase_id",
        message: "Informe um purchaseId valido para filtrar a auditoria.",
      },
    });
  });
});
