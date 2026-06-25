import { NextResponse } from "next/server";
import type { CustomerProfileCitiesResponse } from "@/lib/customer-profile-contracts";
import {
  customerApiErrorResponse,
  requireAuthenticatedCustomerSubject,
} from "@/lib/customer-api-route";
import {
  getActivePublicUserByCpf,
  listProfileCitiesByUf,
  listProfileUfs,
} from "@/lib/user-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const uf = new URL(request.url).searchParams.get("uf")?.trim().toUpperCase() ?? "";

  if (!uf) {
    return customerApiErrorResponse(
      "invalid_uf",
      "Informe um estado valido.",
      400,
    );
  }

  const auth = await requireAuthenticatedCustomerSubject(getActivePublicUserByCpf);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const [ufs] = await Promise.all([
      listProfileUfs(),
    ]);

    if (!ufs.some((option) => option.id === uf)) {
      return customerApiErrorResponse(
        "invalid_uf",
        "Informe um estado valido.",
        400,
      );
    }

    const cities = await listProfileCitiesByUf(uf);

    return NextResponse.json<CustomerProfileCitiesResponse>({
      ok: true,
      data: {
        uf,
        cities,
      },
    });
  } catch (error) {
    console.error("customer-profile-cities-failed", error);

    return customerApiErrorResponse(
      "profile_unavailable",
      "Nao foi possivel consultar as cidades agora.",
      502,
    );
  }
}
