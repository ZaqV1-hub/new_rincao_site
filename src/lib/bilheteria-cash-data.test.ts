import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBilheteriaCashClosureReport, listBilheteriaCashEdits } from "./bilheteria-cash-data";
const { query, release, detail } = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/ingresso-db", () => ({ getIngressoSistemaDbPool: () => ({ connect: async () => ({ query, release }) }) }));
vi.mock("@/lib/ops-cash-closures", () => ({ getOperationalCashClosureDetail: detail, listOperationalCashClosures: vi.fn() }));
describe("legacy cash report reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detail.mockResolvedValue({ id: 4, periodId: 7, openedAt: "2026-04-23T08:00:00Z", closedAt: "2026-04-23T18:00:00Z" });
    query.mockImplementation(async (sql: string) => {
      expect(sql).toMatch(/^\s*(SELECT|WITH)/);
      if (sql.includes("FROM voucher v")) expect(sql).toContain("c.caixa_periodo_id IS NULL");
      if (sql.includes("FROM compra_pagamentos cp")) expect(sql).toContain("cp.periodo_id IS NULL");
      if (sql.includes("c.tpcompra = 'ponli'")) expect(sql).toContain("v.validacao_periodo_id IS NULL");
      if (sql.includes("FROM movimentacao_caixa")) expect(sql).toContain("periodo_id IS NULL");
      return { rows: [] };
    });
  });
  it("prints legacy sources only without writes or backfill", async () => {
    const result = await getBilheteriaCashClosureReport(4);
    expect(result).toMatchObject({ isHistorical: true, closureId: 4 });
    expect(query).toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
  });
  it("lists audit records without creating the audit schema", async () => {
    const result = await listBilheteriaCashEdits({ closureId: 4 });
    expect(result.items).toEqual([]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain("periodo_id = $1");
  });
  it("rejects new closure IDs before querying legacy report sources", async () => {
    detail.mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));
    await expect(getBilheteriaCashClosureReport(99)).rejects.toMatchObject({ status: 404 });
    expect(query).not.toHaveBeenCalled();
  });
});
