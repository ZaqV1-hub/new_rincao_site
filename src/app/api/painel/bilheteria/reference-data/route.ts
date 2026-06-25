import { NextResponse } from "next/server";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asOpsReferenceDataError,
  getOperationalReferenceData,
} from "@/lib/ops-reference-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_bilhet");

  if (!access.ok) {
    return access.response;
  }

  try {
    const referenceData = await getOperationalReferenceData();

    return NextResponse.json({
      ok: true,
      data: referenceData,
    });
  } catch (error) {
    const normalized = asOpsReferenceDataError(error);

    console.error("painel-bilheteria-reference-data-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: normalized.code,
          message: normalized.message,
        },
      },
      { status: normalized.status },
    );
  }
}
