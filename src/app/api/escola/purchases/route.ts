import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { clearAuthCookie, getAuthSession } from "@/lib/auth-session";
import {
  createSchoolPurchase,
  SchoolPurchaseError,
  type CreateSchoolPurchaseInput,
} from "@/lib/school-purchase-repository";
import { getActivePublicUserByCpf } from "@/lib/user-repository";

export const runtime = "nodejs";

type SchoolPurchaseBody = {
  schoolId?: unknown;
  studentName?: unknown;
  educationType?: unknown;
  educationYear?: unknown;
  classLetter?: unknown;
  participantType?: unknown;
  educatorName?: unknown;
  educatorRole?: unknown;
  agendaId?: unknown;
  value?: unknown;
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

function parseBody(body: SchoolPurchaseBody | null): CreateSchoolPurchaseInput | null {
  const schoolId = Number(body?.schoolId);
  const agendaId = Number(body?.agendaId);
  const participantType =
    body?.participantType === "educator" ? "educator" : "student";
  const studentName =
    typeof body?.studentName === "string" ? body.studentName.trim() : "";
  const educationType =
    typeof body?.educationType === "string" ? body.educationType.trim() : "";
  const educationYear =
    typeof body?.educationYear === "string" ? body.educationYear.trim() : "";
  const classLetter =
    typeof body?.classLetter === "string" ? body.classLetter.trim() : "";
  const educatorName =
    typeof body?.educatorName === "string" ? body.educatorName.trim() : "";
  const educatorRole =
    typeof body?.educatorRole === "string" ? body.educatorRole.trim() : "";
  const value = typeof body?.value === "string" ? body.value.trim() : "";

  if (
    !Number.isInteger(schoolId) ||
    schoolId <= 0 ||
    !Number.isInteger(agendaId) ||
    agendaId <= 0
  ) {
    return null;
  }

  if (participantType === "educator") {
    return {
      schoolId,
      agendaId,
      value,
      participantType,
      educatorName,
      educatorRole,
    };
  }

  return {
    schoolId,
    studentName,
    educationType,
    educationYear,
    classLetter,
    agendaId,
    value,
  };
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    return errorResponse(
      "unauthenticated",
      "Sessao nao encontrada ou expirada.",
      401,
    );
  }

  let payload: SchoolPurchaseBody | null = null;

  try {
    payload = (await request.json()) as SchoolPurchaseBody;
  } catch {
    return errorResponse(
      "invalid_school_purchase",
      "Informe escola, aluno, turma, data e valor para continuar.",
      400,
    );
  }

  const purchaseInput = parseBody(payload);

  if (!purchaseInput) {
    return errorResponse(
      "invalid_school_purchase",
      "Informe escola, aluno, turma, data e valor para continuar.",
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

    const created = await createSchoolPurchase(user.cpf, purchaseInput);

    return NextResponse.json({
      ok: true,
      data: {
        ...created,
        checkoutRedirect: `/checkout/${created.purchaseId}`,
      },
    });
  } catch (error) {
    if (error instanceof SchoolPurchaseError) {
      return errorResponse(error.code, error.message, error.status);
    }

    console.error("school-purchase-create-failed", error);

    return errorResponse(
      "school_purchase_unavailable",
      "Nao foi possivel iniciar a compra estudantil agora.",
      502,
    );
  }
}
