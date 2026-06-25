import { NextResponse } from "next/server";
import { getRescheduleAgendaOptionById, getRescheduleAgendaOptions } from "@/lib/agenda-repository";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { readCustomerJsonPayload } from "@/lib/customer-api-route";
import { requireAuthenticatedVoucherRouteId } from "@/lib/customer-voucher-route";
import type {
  UserVoucherRescheduleOptionsResponse,
  UserVoucherRescheduleResponse,
} from "@/lib/voucher-contracts";
import {
  getUserVoucherRescheduleData,
  rescheduleUserVoucher,
} from "@/lib/voucher-repository";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ voucherId: string }>;
};

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

async function getVoucherDataOrResponse(cpf: string, voucherId: number) {
  const voucherData = await getUserVoucherRescheduleData(cpf, voucherId);

  if (!voucherData) {
    return {
      ok: false as const,
      response: errorResponse(
        "voucher_not_found",
        "Voucher nao encontrado para esta conta.",
        404,
      ),
    };
  }

  if (!voucherData.voucher.canReschedule) {
    return {
      ok: false as const,
      response: errorResponse(
        "voucher_reschedule_unavailable",
        "Este voucher nao pode mais ser reagendado.",
        409,
      ),
    };
  }

  return {
    ok: true as const,
    voucherData,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const route = await requireAuthenticatedVoucherRouteId(context, {
    invalidCode: "invalid_voucher_id",
    invalidMessage: "Informe um identificador de voucher valido.",
  });

  if (!route.ok) {
    return route.response;
  }

  const voucherId = route.routeId;

  try {
    const voucherResult = await getVoucherDataOrResponse(route.subject.cpf, voucherId);

    if (!voucherResult.ok) {
      return voucherResult.response;
    }

    const options = (await getRescheduleAgendaOptions()).filter(
      (option) => option.id !== voucherResult.voucherData.agendaId,
    );

    return NextResponse.json<UserVoucherRescheduleOptionsResponse>({
      ok: true,
      data: {
        voucherId,
        currentVisitDate: voucherResult.voucherData.voucher.visitDate,
        options: options.map((option) => ({
          id: option.id,
          date: option.date,
          day: option.day,
          month: option.month,
          year: option.year,
        })),
      },
    });
  } catch (error) {
    console.error("voucher-reschedule-options-bff-failed", error);

    return errorResponse(
      "voucher_reschedule_unavailable",
      "Nao foi possivel consultar as datas de reagendamento agora.",
      502,
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const route = await requireAuthenticatedVoucherRouteId(context, {
    invalidCode: "invalid_voucher_id",
    invalidMessage: "Informe um identificador de voucher valido.",
  });

  if (!route.ok) {
    return route.response;
  }

  const voucherId = route.routeId;
  const payload = await readCustomerJsonPayload<{ agendaId?: number }>(request);

  const agendaId = Number(payload?.agendaId);

  if (!Number.isInteger(agendaId) || agendaId <= 0) {
    return errorResponse(
      "invalid_agenda_id",
      "Informe uma data valida para reagendamento.",
      400,
    );
  }

  try {
    const voucherResult = await getVoucherDataOrResponse(route.subject.cpf, voucherId);

    if (!voucherResult.ok) {
      return voucherResult.response;
    }

    if (voucherResult.voucherData.agendaId === agendaId) {
      return errorResponse(
        "invalid_agenda_selection",
        "Escolha uma nova data para reagendamento.",
        409,
      );
    }

    const targetAgenda = await getRescheduleAgendaOptionById(agendaId);

    if (!targetAgenda) {
      return errorResponse(
        "agenda_not_found",
        "A data escolhida nao esta disponivel para reagendamento.",
        404,
      );
    }

    const rescheduledVoucherId = await rescheduleUserVoucher(
      route.subject.cpf,
      voucherId,
      agendaId,
    );

    if (!rescheduledVoucherId) {
      return errorResponse(
        "voucher_reschedule_unavailable",
        "Nao foi possivel concluir o reagendamento agora.",
        409,
      );
    }

    return NextResponse.json<UserVoucherRescheduleResponse>({
      ok: true,
      data: {
        voucherId: rescheduledVoucherId,
        agendaId: targetAgenda.id,
        visitDate: targetAgenda.date,
        day: targetAgenda.day,
        month: targetAgenda.month,
        year: targetAgenda.year,
      },
    });
  } catch (error) {
    console.error("voucher-reschedule-bff-failed", error);

    return errorResponse(
      "voucher_reschedule_unavailable",
      "Nao foi possivel concluir o reagendamento agora.",
      502,
    );
  }
}
