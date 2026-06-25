import { NextResponse } from "next/server";
import {
  customerApiErrorResponse,
  readCustomerJsonPayload,
  requireAuthenticatedCustomerSubject,
} from "@/lib/customer-api-route";
import type {
  CreatePurchaseRequest,
  CreatePurchaseResponse,
} from "@/lib/purchase-contracts";
import {
  createOnlinePurchase,
  PurchaseCreationError,
} from "@/lib/purchase-repository";
import { getActivePublicUserByCpf } from "@/lib/user-repository";

export const runtime = "nodejs";

type PurchaseBody = {
  agendaId?: unknown;
  codindica?: unknown;
  lineItems?: Array<{
    productId?: unknown;
    quantity?: unknown;
  }>;
  quantities?: {
    discountedNormal?: unknown;
    discountedChild?: unknown;
    normal?: unknown;
    child?: unknown;
    exempt?: unknown;
  };
};

function parseQuantity(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 0) {
    return null;
  }

  return Number(value);
}

function parseRequestBody(body: PurchaseBody | null): CreatePurchaseRequest | null {
  const agendaId = Number(body?.agendaId);
  const codindica =
    typeof body?.codindica === "string"
      ? body.codindica.trim().toUpperCase()
      : body?.codindica === undefined
        ? undefined
        : null;
  if (!Number.isInteger(agendaId) || agendaId <= 0) {
    return null;
  }

  if (codindica === null) {
    return null;
  }

  if (Array.isArray(body?.lineItems)) {
    const lineItems = body.lineItems.map((item) => {
      const quantity = parseQuantity(item?.quantity);

      if (typeof item?.productId !== "string" || quantity === null || quantity <= 0) {
        return null;
      }

      return {
        productId: item.productId,
        quantity,
      };
    });

    if (lineItems.length === 0 || lineItems.some((item) => item === null)) {
      return null;
    }

    return {
      agendaId,
      codindica: codindica || undefined,
      lineItems: lineItems as NonNullable<CreatePurchaseRequest["lineItems"]>,
    };
  }

  const discountedNormal = parseQuantity(body?.quantities?.discountedNormal);
  const discountedChild = parseQuantity(body?.quantities?.discountedChild);
  const normal = parseQuantity(body?.quantities?.normal);
  const child = parseQuantity(body?.quantities?.child);
  const exempt = parseQuantity(body?.quantities?.exempt);

  if (
    discountedNormal === null ||
    discountedChild === null ||
    normal === null ||
    child === null ||
    exempt === null
  ) {
    return null;
  }

  return {
    agendaId,
    codindica: codindica || undefined,
    quantities: {
      discountedNormal,
      discountedChild,
      normal,
      child,
      exempt,
    },
  };
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedCustomerSubject(getActivePublicUserByCpf);

  if (!auth.ok) {
    return auth.response;
  }

  const payload = await readCustomerJsonPayload<PurchaseBody>(request);

  if (!payload) {
    return customerApiErrorResponse(
      "invalid_purchase",
      "Informe agenda e quantidades validas para continuar.",
      400,
    );
  }

  const purchase = parseRequestBody(payload);

  if (!purchase) {
    return customerApiErrorResponse(
      "invalid_purchase",
      "Informe agenda e quantidades validas para continuar.",
      400,
    );
  }

  try {
    const user = auth.subject;
    const selection = purchase.lineItems
      ? { lineItems: purchase.lineItems }
      : purchase.quantities;

    if (!selection) {
      return customerApiErrorResponse(
        "invalid_purchase",
        "Informe agenda e quantidades validas para continuar.",
        400,
      );
    }

    const created = await createOnlinePurchase(
      user.cpf,
      purchase.agendaId,
      selection,
      purchase.codindica,
    );

    return NextResponse.json<CreatePurchaseResponse>({
      ok: true,
      data: {
        ...created,
        checkoutRedirect: `/checkout/${created.purchaseId}`,
      },
    });
  } catch (error) {
    if (error instanceof PurchaseCreationError) {
      return customerApiErrorResponse(error.code, error.message, error.status);
    }

    console.error("purchase-create-bff-failed", error);

    return customerApiErrorResponse(
      "purchase_unavailable",
      "Nao foi possivel iniciar a compra agora.",
      502,
    );
  }
}
