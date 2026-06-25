import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import type { CustomerRegistrationLocationsResponse } from "@/lib/customer-registration-contracts";
import {
  listProfileCitiesByUf,
  listProfileUfs,
} from "@/lib/user-repository";

export const runtime = "nodejs";

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

export async function GET(request: Request) {
  const selectedUf =
    new URL(request.url).searchParams.get("uf")?.trim().toUpperCase() || "";

  try {
    const ufs = await listProfileUfs();

    if (selectedUf && !ufs.some((option) => option.id === selectedUf)) {
      return errorResponse(
        "invalid_uf",
        "Informe um estado valido.",
        400,
      );
    }

    const cities = selectedUf
      ? await listProfileCitiesByUf(selectedUf)
      : [];

    return NextResponse.json<CustomerRegistrationLocationsResponse>({
      ok: true,
      data: {
        ufs,
        cities,
        selectedUf: selectedUf || null,
      },
    });
  } catch (error) {
    console.error("customer-registration-data-failed", error);

    return errorResponse(
      "registration_data_unavailable",
      "Nao foi possivel carregar os dados de cadastro agora.",
      502,
    );
  }
}
