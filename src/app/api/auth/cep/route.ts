import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import type { CustomerRegistrationCepResponse } from "@/lib/customer-registration-contracts";
import { ensureProfileCity, ensureProfileUf } from "@/lib/user-repository";

export const runtime = "nodejs";

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
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

function sanitizeCep(value: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

function normalizeCityName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cep = sanitizeCep(url.searchParams.get("cep"));

  if (!cep) {
    return errorResponse("invalid_cep", "Informe um CEP valido.", 400);
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return errorResponse(
        "cep_lookup_unavailable",
        "Nao foi possivel consultar o CEP agora.",
        502,
      );
    }

    const payload = (await response.json()) as ViaCepResponse;

    if (
      payload.erro ||
      !payload.logradouro?.trim() ||
      !payload.bairro?.trim() ||
      !payload.localidade?.trim() ||
      !payload.uf?.trim()
    ) {
      return errorResponse("cep_not_found", "CEP nao encontrado.", 404);
    }

    const uf = await ensureProfileUf({
      id: payload.uf.trim().toUpperCase(),
      name: payload.uf.trim().toUpperCase(),
    });
    const city = await ensureProfileCity({
      uf: uf.id,
      name: normalizeCityName(payload.localidade),
    });

    return NextResponse.json<CustomerRegistrationCepResponse>({
      ok: true,
      data: {
        cep,
        address: payload.logradouro.trim(),
        district: payload.bairro.trim(),
        uf,
        city,
        complement: payload.complemento?.trim() || null,
      },
    });
  } catch (error) {
    console.error("customer-registration-cep-lookup-failed", error);

    return errorResponse(
      "cep_lookup_unavailable",
      "Nao foi possivel consultar o CEP agora.",
      502,
    );
  }
}
