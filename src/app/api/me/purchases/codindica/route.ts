import { NextResponse } from "next/server";
import {
  customerApiErrorResponse,
  readCustomerJsonPayload,
  requireAuthenticatedCustomerSubject,
} from "@/lib/customer-api-route";
import {
  previewOnlinePurchaseCodindica,
  PurchaseCreationError,
} from "@/lib/purchase-repository";
import { getActivePublicUserByCpf } from "@/lib/user-repository";

export const runtime = "nodejs";

type PurchaseCodindicaPreviewBody = {
  agendaId?: unknown;
  codindica?: unknown;
  lineItems?: Array<{
    productId?: unknown;
    quantity?: unknown;
  }>;
};

function parseQuantity(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 0) {
    return null;
  }

  return Number(value);
}

function parseRequestBody(body: PurchaseCodindicaPreviewBody | null) {
  const agendaId = Number(body?.agendaId);
  const codindica =
    typeof body?.codindica === "string"
      ? body.codindica.trim().toUpperCase()
      : null;

  if (!Number.isInteger(agendaId) || agendaId <= 0 || !codindica) {
    return null;
  }

  if (!Array.isArray(body?.lineItems) || body.lineItems.length === 0) {
    return null;
  }

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

  if (lineItems.some((item) => item === null)) {
    return null;
  }

  return {
    agendaId,
    codindica,
    lineItems: lineItems as Array<{ productId: string; quantity: number }>,
  };
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedCustomerSubject(getActivePublicUserByCpf);

  if (!auth.ok) {
    return auth.response;
  }

  const payload = await readCustomerJsonPayload<PurchaseCodindicaPreviewBody>(request);
  const parsed = parseRequestBody(payload);

  if (!parsed) {
    return customerApiErrorResponse(
      "invalid_purchase",
      "Informe agenda, itens e codigo validos para continuar.",
      400,
    );
  }

  try {
    const data = await previewOnlinePurchaseCodindica(
      parsed.agendaId,
      { lineItems: parsed.lineItems },
      parsed.codindica,
    );

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof PurchaseCreationError) {
      return customerApiErrorResponse(error.code, error.message, error.status);
    }

    console.error("purchase-codindica-preview-bff-failed", error);

    return customerApiErrorResponse(
      "purchase_unavailable",
      "Nao foi possivel validar o codigo agora.",
      502,
    );
  }
}
