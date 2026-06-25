import { beforeEach, describe, expect, it, vi } from "vitest";
import { listOperationalAuditLogs } from "@/lib/ops-audit-history";

const { connect, query, release, ensureOpsAuditLogTable } = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  release: vi.fn(),
  ensureOpsAuditLogTable: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    connect,
  }),
}));

vi.mock("@/lib/ops-audit-log", () => ({
  ensureOpsAuditLogTable,
}));

describe("ops-audit-history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue({
      query,
      release,
    });
  });

  it("lists audit log entries with purchase, voucher and agenda filters", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 901,
            origem: "compra",
            acao: "editar",
            compra_id: 321,
            descricao: "Valor alterado",
            motivo: "Ajuste manual",
            usuario_nome: "Gestor Teste",
            detalhes_json: '{"via":"apps/web"}',
            created_at: "2026-04-23 14:01:00+00",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ total: "1" }],
      });

    await expect(
      listOperationalAuditLogs({
        purchaseId: 321,
        voucherId: 9001,
        agendaId: 88,
        limit: 10,
        offset: 0,
      }),
    ).resolves.toEqual({
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

    expect(ensureOpsAuditLogTable).toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("affectedVoucherIds"),
      [321, 9001, 88, 88, 10, 0],
    );
  });

  it("rejects invalid purchase id filters", async () => {
    await expect(
      listOperationalAuditLogs({
        purchaseId: -1,
      }),
    ).rejects.toMatchObject({
      code: "invalid_purchase_id",
      status: 400,
    });

    expect(connect).not.toHaveBeenCalled();
  });

  it("rejects invalid voucher and agenda filters", async () => {
    await expect(
      listOperationalAuditLogs({
        voucherId: 0,
      }),
    ).rejects.toMatchObject({
      code: "invalid_voucher_id",
      status: 400,
    });

    await expect(
      listOperationalAuditLogs({
        agendaId: -10,
      }),
    ).rejects.toMatchObject({
      code: "invalid_agenda_id",
      status: 400,
    });

    expect(connect).not.toHaveBeenCalled();
  });
});
