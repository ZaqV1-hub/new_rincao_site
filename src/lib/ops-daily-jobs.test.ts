import { beforeEach, describe, expect, it, vi } from "vitest";
import { runOperationalDailyJobs } from "@/lib/ops-daily-jobs";

const {
  syncOperationalPaymentStatuses,
  recoverPendingTicketDeliveries,
  autoCloseOperationalCashClosures,
  runMembershipMaintenance,
} = vi.hoisted(() => ({
  syncOperationalPaymentStatuses: vi.fn(),
  recoverPendingTicketDeliveries: vi.fn(),
  autoCloseOperationalCashClosures: vi.fn(),
  runMembershipMaintenance: vi.fn(),
}));

vi.mock("@/lib/ops-payment-sync", () => ({
  syncOperationalPaymentStatuses,
}));

vi.mock("@/lib/ticket-service", () => ({
  recoverPendingTicketDeliveries,
}));

vi.mock("@/lib/ops-cash-closures", () => ({
  autoCloseOperationalCashClosures,
}));

vi.mock("@/lib/ops-membership-maintenance", () => ({
  runMembershipMaintenance,
}));

describe("ops-daily-jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the three operational jobs in sequence", async () => {
    syncOperationalPaymentStatuses.mockResolvedValue({
      action: "payment_sync",
      configured: true,
      candidates: 1,
      processed: 1,
      reconciled: 1,
      cancelled: 0,
      missing: 0,
      skipped: 0,
      failed: 0,
      items: [],
      message: "Reconciliacao operacional executada para 1 compra(s).",
    });
    autoCloseOperationalCashClosures.mockResolvedValue({
      action: "auto_close",
      closedCount: 1,
      closedPeriodIds: [6],
      closureIds: [55],
      currentSummary: {
        period: {
          id: 7,
          openedAt: "2026-04-23 03:00:00+00",
          closedAt: null,
          operator: null,
          closureSheetId: null,
        },
        funds: [],
        sangrias: [],
        totals: {
          cashSales: "0.00",
          fund: "0.00",
          sangria: "0.00",
          cashInDrawer: "0.00",
        },
      },
      auditLogIds: [901],
      message: "1 periodo(s) anterior(es) fechados automaticamente.",
    });
    recoverPendingTicketDeliveries.mockResolvedValue({
      action: "ticket_delivery_recovery",
      candidates: 1,
      processed: 1,
      recovered: 1,
      skipped: 0,
      failed: 0,
      items: [
        {
          purchaseId: 321,
          pendingVouchers: 1,
          result: "sent",
          sentVoucherIds: [9001],
          note: "Entrega recuperada com sucesso.",
        },
      ],
      message: "Recuperacao de entrega executada para 1 compra(s).",
    });
    runMembershipMaintenance.mockResolvedValue({
      action: "membership_maintenance",
      processed: 4,
      items: [
        { domain: "socio", deactivated: 1 },
        { domain: "convenio", deactivated: 1 },
        { domain: "conveniado", deactivated: 2 },
      ],
      message: "4 registro(s) inativados por vigencia.",
    });

    const result = await runOperationalDailyJobs({
      actor: {
        name: "Gestor Operacional",
      },
      cashAutoCloseReason: "Virada diaria",
      paymentSync: {
        recentDays: 7,
        cancelAfterDays: 5,
        limit: 50,
      },
    });

    expect(result.action).toBe("daily_jobs");
    expect(result.overallStatus).toBe("success");
    expect(result.steps.paymentSync).toMatchObject({
      action: "payment_sync",
      status: "success",
    });
    expect(result.steps.ticketDeliveryRecovery).toMatchObject({
      action: "ticket_delivery_recovery",
      status: "success",
    });
    expect(result.steps.cashAutoClose).toMatchObject({
      action: "cash_auto_close",
      status: "success",
    });
    expect(result.steps.membershipMaintenance).toMatchObject({
      action: "membership_maintenance",
      status: "success",
    });
    expect(syncOperationalPaymentStatuses).toHaveBeenCalledWith({
      recentDays: 7,
      cancelAfterDays: 5,
      limit: 50,
    });
    expect(recoverPendingTicketDeliveries).toHaveBeenCalledWith();
    expect(autoCloseOperationalCashClosures).toHaveBeenCalledWith({
      reason: "Virada diaria",
      actor: {
        name: "Gestor Operacional",
      },
    });
  });

  it("keeps the run partial when one step fails", async () => {
    syncOperationalPaymentStatuses.mockRejectedValue(new Error("gateway offline"));
    recoverPendingTicketDeliveries.mockResolvedValue({
      action: "ticket_delivery_recovery",
      candidates: 0,
      processed: 0,
      recovered: 0,
      skipped: 0,
      failed: 0,
      items: [],
      message: "Nenhuma compra elegivel para recuperacao de entrega.",
    });
    autoCloseOperationalCashClosures.mockResolvedValue({
      action: "auto_close",
      closedCount: 0,
      closedPeriodIds: [],
      closureIds: [],
      currentSummary: {
        period: {
          id: 7,
          openedAt: "2026-04-23 03:00:00+00",
          closedAt: null,
          operator: null,
          closureSheetId: null,
        },
        funds: [],
        sangrias: [],
        totals: {
          cashSales: "0.00",
          fund: "0.00",
          sangria: "0.00",
          cashInDrawer: "0.00",
        },
      },
      auditLogIds: [],
      message: "Nenhum periodo anterior elegivel para fechamento automatico.",
    });
    runMembershipMaintenance.mockResolvedValue({
      action: "membership_maintenance",
      processed: 0,
      items: [
        { domain: "socio", deactivated: 0 },
        { domain: "convenio", deactivated: 0 },
        { domain: "conveniado", deactivated: 0 },
      ],
      message: "Nenhum socio, convenio ou conveniado expirado para inativar.",
    });

    const result = await runOperationalDailyJobs();

    expect(result.overallStatus).toBe("partial");
    expect(result.steps.paymentSync).toEqual({
      action: "payment_sync",
      status: "failed",
      error: "gateway offline",
    });
  });
});
