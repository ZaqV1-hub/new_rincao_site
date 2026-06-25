import { NextResponse } from "next/server";
import { searchSchoolsByName } from "@/lib/school-purchase-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const term = url.searchParams.get("term") ?? "";

  try {
    const schools = await searchSchoolsByName(term);

    return NextResponse.json({
      ok: true,
      data: {
        schools,
      },
    });
  } catch (error) {
    console.error("school-search-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "school_search_unavailable",
          message: "Nao foi possivel buscar escolas agora.",
        },
      },
      { status: 502 },
    );
  }
}
