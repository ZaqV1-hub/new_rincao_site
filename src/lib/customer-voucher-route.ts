import {
  customerApiErrorResponse,
  parsePositiveRouteId,
  requireAuthenticatedCustomerSubject,
} from "@/lib/customer-api-route";
import { getActivePublicUserByCpf } from "@/lib/user-repository";

type VoucherRouteContext = {
  params: Promise<{ voucherId: string }>;
};

export async function requireAuthenticatedVoucherRouteId(
  context: VoucherRouteContext,
  options: {
    invalidCode: string;
    invalidMessage: string;
  },
) {
  const auth = await requireAuthenticatedCustomerSubject(getActivePublicUserByCpf);

  if (!auth.ok) {
    return auth;
  }

  const { voucherId: voucherIdParam } = await context.params;
  const routeId = parsePositiveRouteId(voucherIdParam);

  if (!routeId) {
    return {
      ok: false as const,
      response: customerApiErrorResponse(
        options.invalidCode,
        options.invalidMessage,
        400,
      ),
    };
  }

  return {
    ok: true as const,
    subject: auth.subject,
    routeId,
  };
}

export function parseDistinctPositiveIds(values: Iterable<unknown>) {
  const ids = Array.from(values, (value) => Number(value));

  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    return null;
  }

  return Array.from(new Set(ids));
}
