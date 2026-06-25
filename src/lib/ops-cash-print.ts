import type { BilheteriaCashClosureReportModel } from "@/lib/bilheteria-cash-view-model";
import type { OperationalCashClosureDetail } from "@/lib/ops-cash-closures";

export type CashClosurePrintModel = {
  closureId: number | null;
  periodId: number | null;
  operator: string | null;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
  report: BilheteriaCashClosureReportModel;
};

export function buildCashClosurePrintModel(
  detail: Pick<
    OperationalCashClosureDetail,
    "id" | "periodId" | "operator" | "openedAt" | "closedAt" | "createdAt"
  > | null,
  report: BilheteriaCashClosureReportModel,
): CashClosurePrintModel {
  return {
    closureId: detail?.id ?? null,
    periodId: detail?.periodId ?? null,
    operator: detail?.operator ?? null,
    openedAt: detail?.openedAt ?? report.period.openedAt,
    closedAt: detail?.closedAt ?? report.period.closedAt,
    createdAt: detail?.createdAt ?? report.period.closedAt,
    report,
  };
}
