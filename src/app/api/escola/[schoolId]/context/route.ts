import { NextResponse } from "next/server";
import { getSchoolPurchaseContext } from "@/lib/school-purchase-repository";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    schoolId: string;
  }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const schoolId = Number((await params).schoolId);

  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_school",
          message: "Escola invalida.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const context = await getSchoolPurchaseContext(schoolId);

    if (!context) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "school_context_not_found",
            message: "Nenhuma data aberta foi encontrada para esta escola.",
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: context,
    });
  } catch (error) {
    console.error("school-context-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "school_context_unavailable",
          message: "Nao foi possivel carregar os dados da escola agora.",
        },
      },
      { status: 502 },
    );
  }
}
