import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { clearAuthCookie, getAuthSession } from "@/lib/auth-session";
import { syncCheckoutStatus } from "@/lib/checkout-status";
import { getActivePublicUserByCpf } from "@/lib/user-repository";
import { getUserVoucherPurchaseById } from "@/lib/voucher-repository";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json<AuthErrorResponse>(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export async function GET(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    return errorResponse(
      "unauthenticated",
      "Sessao nao encontrada ou expirada.",
      401,
    );
  }

  const url = new URL(request.url);
  const purchaseId = Number(
    url.searchParams.get("reference") ?? url.searchParams.get("idcompra"),
  );

  if (!Number.isInteger(purchaseId) || purchaseId <= 0) {
    return errorResponse(
      "checkout_unavailable",
      "Compra invalida para consultar o checkout.",
      400,
    );
  }

  try {
    const user = await getActivePublicUserByCpf(session.sub);

    if (!user) {
      const response = errorResponse(
        "unauthenticated",
        "Sessao nao encontrada ou expirada.",
        401,
      );
      clearAuthCookie(response);

      return response;
    }

    const purchase = await getUserVoucherPurchaseById(user.cpf, purchaseId);

    if (!purchase || purchase.type !== "ponli") {
      return errorResponse(
        "checkout_unavailable",
        "Compra invalida para consultar o checkout.",
        404,
      );
    }

    const synced = await syncCheckoutStatus(purchase, url.searchParams);

    return NextResponse.json(synced.body, {
      status: synced.status,
      headers: {
        "content-type": synced.contentType,
      },
    });
  } catch (error) {
    console.error("checkout-status-proxy-failed", error);

    return errorResponse(
      "checkout_unavailable",
      "Nao foi possivel consultar o checkout agora.",
      502,
    );
  }
}
