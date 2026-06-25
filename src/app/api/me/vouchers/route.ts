import { NextResponse } from "next/server";
import {
  customerApiErrorResponse,
  requireAuthenticatedCustomerSubject,
} from "@/lib/customer-api-route";
import { getActivePublicUserByCpf } from "@/lib/user-repository";
import type { UserVouchersResponse } from "@/lib/voucher-contracts";
import { getUserVouchersPage } from "@/lib/voucher-repository";

export const runtime = "nodejs";

function parsePagination(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isInteger(offset) ||
    offset < 0
  ) {
    return null;
  }

  return { limit, offset };
}

export async function GET(request: Request) {
  const pagination = parsePagination(request);

  if (!pagination) {
    return customerApiErrorResponse(
      "invalid_pagination",
      "Informe limit e offset validos.",
      400,
    );
  }

  const auth = await requireAuthenticatedCustomerSubject(getActivePublicUserByCpf);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const user = auth.subject;

    const page = await getUserVouchersPage(
      user.cpf,
      pagination.limit,
      pagination.offset,
    );
    const purchases = page.purchases;

    return NextResponse.json<UserVouchersResponse>({
      ok: true,
      data: {
        limit: pagination.limit,
        offset: pagination.offset,
        totalPurchases: page.totalPurchases,
        purchases,
        groups: {
          online: purchases.filter((purchase) => purchase.type === "ponli"),
          reservations: purchases.filter((purchase) => purchase.type === "reser"),
        },
      },
    });
  } catch (error) {
    console.error("user-vouchers-bff-failed", error);

    return customerApiErrorResponse(
      "vouchers_unavailable",
      "Nao foi possivel consultar os vouchers agora.",
      502,
    );
  }
}
