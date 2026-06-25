import { notFound } from "next/navigation";
import { getBilheteriaCashClosureReport } from "@/lib/bilheteria-cash-data";
import {
  asOperationalCashClosureError,
  getOperationalCashClosureDetail,
} from "@/lib/ops-cash-closures";
import { buildCashClosurePrintModel } from "@/lib/ops-cash-print";

export async function loadCashClosurePrintModel(closureId: string) {
  const id = Number(closureId);

  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }

  try {
    const detail = await getOperationalCashClosureDetail(id);
    const { report } = await getBilheteriaCashClosureReport(id);

    return buildCashClosurePrintModel(detail, report);
  } catch (error) {
    const normalized = asOperationalCashClosureError(error);

    if (
      normalized.code === "invalid_cash_closure_id" ||
      normalized.code === "cash_closure_not_found"
    ) {
      notFound();
    }

    throw error;
  }
}

export async function loadCurrentCashClosurePrintModel() {
  const { report } = await getBilheteriaCashClosureReport(null);
  return buildCashClosurePrintModel(null, report);
}
