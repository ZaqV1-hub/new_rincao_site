import { redirect } from "next/navigation";
import { getPainelBilheteriaPurchaseDetail } from "@/lib/painel-bilheteria";
import { requirePainelAccess } from "@/lib/painel-session";

export async function requirePainelBilheteriaHistorySession() {
  const session = await requirePainelAccess(
    "vis_bilhet",
    "/painel/bilheteria/historico",
  );

  if (session.legacyRoleId !== 1) {
    redirect("/painel/bilheteria");
  }

  return session;
}

export async function loadPainelBilheteriaPurchaseDetailFromParams(
  params: Promise<{ purchaseId: string }>,
) {
  const routeParams = await params;
  const purchaseId = Number(routeParams.purchaseId);
  const detail = await getPainelBilheteriaPurchaseDetail(purchaseId);

  return {
    purchaseId,
    detail,
  };
}

export function readPainelBilheteriaFlashState(searchParams?: {
  success?: string;
  warning?: string | string[];
}) {
  const flashSuccess =
    typeof searchParams?.success === "string" &&
    searchParams.success.trim() !== ""
      ? searchParams.success
      : null;
  const flashWarnings = Array.isArray(searchParams?.warning)
    ? searchParams.warning.filter((warning) => warning.trim() !== "")
    : typeof searchParams?.warning === "string" &&
        searchParams.warning.trim() !== ""
      ? [searchParams.warning]
      : [];

  return { flashSuccess, flashWarnings };
}
