import { NextResponse } from "next/server";
import {
  customerApiErrorResponse,
  readCustomerJsonPayload,
  requireAuthenticatedCustomerSubject,
} from "@/lib/customer-api-route";
import type {
  CreateReservationRequest,
  CreateReservationResponse,
} from "@/lib/reservation-contracts";
import {
  createReservationPurchase,
  ReservationCreationError,
} from "@/lib/reservation-repository";
import { getActivePublicUserByCpf } from "@/lib/user-repository";

export const runtime = "nodejs";

type ReservationBody = {
  agendaId?: unknown;
  quantities?: {
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

function parseRequestBody(body: ReservationBody | null): CreateReservationRequest | null {
  const agendaId = Number(body?.agendaId);
  const normal = parseQuantity(body?.quantities?.normal);
  const child = parseQuantity(body?.quantities?.child);
  const exempt = parseQuantity(body?.quantities?.exempt);

  if (!Number.isInteger(agendaId) || agendaId <= 0) {
    return null;
  }

  if (normal === null || child === null || exempt === null) {
    return null;
  }

  if (normal + child + exempt <= 0) {
    return null;
  }

  return {
    agendaId,
    quantities: {
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

  const payload = await readCustomerJsonPayload<ReservationBody>(request);

  if (!payload) {
    return customerApiErrorResponse(
      "invalid_reservation",
      "Informe agenda e quantidades validas para reservar.",
      400,
    );
  }

  const reservation = parseRequestBody(payload);

  if (!reservation) {
    return customerApiErrorResponse(
      "invalid_reservation",
      "Informe agenda e quantidades validas para reservar.",
      400,
    );
  }

  try {
    const user = auth.subject;

    const created = await createReservationPurchase(
      user.cpf,
      reservation.agendaId,
      reservation.quantities,
    );

    return NextResponse.json<CreateReservationResponse>({
      ok: true,
      data: created,
    });
  } catch (error) {
    if (error instanceof ReservationCreationError) {
      return customerApiErrorResponse(error.code, error.message, error.status);
    }

    console.error("reservation-create-bff-failed", error);

    return customerApiErrorResponse(
      "reservation_unavailable",
      "Nao foi possivel concluir a reserva agora.",
      502,
    );
  }
}
