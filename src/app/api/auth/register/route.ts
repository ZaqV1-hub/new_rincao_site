import { NextResponse } from "next/server";
import type {
  AuthErrorResponse,
  AuthRegistrationResponse,
} from "@/lib/auth-contracts";
import { createAuthSessionToken, setAuthCookie } from "@/lib/auth-session";
import {
  createPublicUser,
  findPublicUserByCpf,
  findPublicUserByEmail,
  getProfileCityById,
  isValidCpf,
  listProfileUfs,
  sanitizeCpf,
} from "@/lib/user-repository";

export const runtime = "nodejs";

type RegisterPayload = {
  cpf?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
  name?: unknown;
  email?: unknown;
  rg?: unknown;
  birthDate?: unknown;
  sex?: unknown;
  phone?: unknown;
  mobile?: unknown;
  address?: unknown;
  number?: unknown;
  cep?: unknown;
  district?: unknown;
  uf?: unknown;
  cityId?: unknown;
  complement?: unknown;
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

async function parsePayload(request: Request) {
  try {
    return (await request.json()) as RegisterPayload;
  } catch {
    return null;
  }
}

function cleanText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function cleanOptionalText(value: unknown, maxLength: number) {
  const normalized = cleanText(value);

  if (!normalized) {
    return { ok: true as const, value: null };
  }

  if (normalized.length > maxLength) {
    return { ok: false as const };
  }

  return { ok: true as const, value: normalized };
}

function cleanRequiredText(value: unknown, maxLength: number) {
  const normalized = cleanText(value);

  if (!normalized || normalized.length > maxLength) {
    return { ok: false as const };
  }

  return { ok: true as const, value: normalized };
}

function cleanBirthDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return value;
}

function cleanCep(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const digits = value.replace(/\D/g, "");

  return digits.length === 8 ? digits : null;
}

function cleanOptionalPhone(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  return digits.length <= 14 ? digits : null;
}

export async function POST(request: Request) {
  const payload = await parsePayload(request);

  if (!payload) {
    return errorResponse(
      "invalid_registration",
      "Informe os dados do cadastro em JSON.",
      400,
    );
  }

  const cpf = sanitizeCpf(String(payload.cpf ?? ""));
  const password = typeof payload.password === "string" ? payload.password : "";
  const confirmPassword =
    typeof payload.confirmPassword === "string" ? payload.confirmPassword : "";

  if (!isValidCpf(cpf)) {
    return errorResponse(
      "invalid_registration",
      "Informe um CPF valido.",
      400,
    );
  }

  if (password.length < 1 || password.length > 20) {
    return errorResponse(
      "invalid_registration",
      "Informe uma senha com ate 20 caracteres.",
      400,
    );
  }

  if (confirmPassword !== password) {
    return errorResponse(
      "invalid_registration",
      "A confirmacao da senha deve ser igual a senha.",
      400,
    );
  }

  const name = cleanRequiredText(payload.name, 120);

  if (!name.ok) {
    return errorResponse(
      "invalid_registration",
      "Informe um nome completo valido.",
      400,
    );
  }

  const email = cleanRequiredText(payload.email, 120);

  if (!email.ok || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    return errorResponse(
      "invalid_registration",
      "Informe um e-mail valido.",
      400,
    );
  }

  const rg = cleanOptionalText(payload.rg, 10);

  if (!rg.ok) {
    return errorResponse(
      "invalid_registration",
      "Informe um RG com ate 10 caracteres.",
      400,
    );
  }

  const birthDate = cleanBirthDate(payload.birthDate);

  if (!birthDate) {
    return errorResponse(
      "invalid_registration",
      "Informe uma data de nascimento valida.",
      400,
    );
  }

  const sex = typeof payload.sex === "string" ? payload.sex.trim().toLowerCase() : "";

  if (sex !== "m" && sex !== "f") {
    return errorResponse(
      "invalid_registration",
      "Selecione um sexo valido.",
      400,
    );
  }

  const phone = cleanOptionalPhone(payload.phone);

  if (payload.phone && !phone) {
    return errorResponse(
      "invalid_registration",
      "Informe um telefone valido.",
      400,
    );
  }

  const mobile = cleanOptionalPhone(payload.mobile);

  if (payload.mobile && !mobile) {
    return errorResponse(
      "invalid_registration",
      "Informe um celular valido.",
      400,
    );
  }

  const address = cleanRequiredText(payload.address, 100);

  if (!address.ok) {
    return errorResponse(
      "invalid_registration",
      "Informe um endereco valido.",
      400,
    );
  }

  const number = cleanOptionalText(payload.number, 20);

  if (!number.ok || (number.value && !/^\d+$/.test(number.value))) {
    return errorResponse(
      "invalid_registration",
      "Informe um numero valido.",
      400,
    );
  }

  const district = cleanRequiredText(payload.district, 50);

  if (!district.ok) {
    return errorResponse(
      "invalid_registration",
      "Informe um bairro valido.",
      400,
    );
  }

  const complement = cleanOptionalText(payload.complement, 50);

  if (!complement.ok) {
    return errorResponse(
      "invalid_registration",
      "Informe um complemento com ate 50 caracteres.",
      400,
    );
  }

  const cep = cleanCep(payload.cep);

  if (!cep) {
    return errorResponse(
      "invalid_registration",
      "Informe um CEP valido.",
      400,
    );
  }

  const uf = typeof payload.uf === "string" ? payload.uf.trim().toUpperCase() : "";
  const cityId =
    typeof payload.cityId === "number"
      ? payload.cityId
      : Number(payload.cityId);

  if (!uf) {
    return errorResponse(
      "invalid_registration",
      "Selecione um estado valido.",
      400,
    );
  }

  if (!Number.isInteger(cityId) || cityId <= 0) {
    return errorResponse(
      "invalid_registration",
      "Selecione uma cidade valida.",
      400,
    );
  }

  try {
    const [ufs, city, existingCpf, existingEmail] = await Promise.all([
      listProfileUfs(),
      getProfileCityById(cityId),
      findPublicUserByCpf(cpf),
      findPublicUserByEmail(email.value),
    ]);

    if (!ufs.some((option) => option.id === uf)) {
      return errorResponse(
        "invalid_registration",
        "Selecione um estado valido.",
        400,
      );
    }

    if (!city || city.uf !== uf) {
      return errorResponse(
        "invalid_registration",
        "Selecione uma cidade valida para o estado informado.",
        400,
      );
    }

    if (existingCpf) {
      return errorResponse(
        "cpf_in_use",
        "Seu CPF ja esta vinculado a uma conta.",
        409,
      );
    }

    if (existingEmail) {
      return errorResponse(
        "email_in_use",
        "Este e-mail ja esta vinculado a outra conta.",
        409,
      );
    }

    const user = await createPublicUser({
      cpf,
      password,
      name: name.value,
      email: email.value,
      rg: rg.value,
      birthDate,
      sex,
      phone,
      mobile,
      address: address.value,
      number: number.value,
      cep,
      district: district.value,
      uf,
      cityId,
      complement: complement.value,
    });

    if (!user) {
      return errorResponse(
        "registration_unavailable",
        "Nao foi possivel concluir o cadastro agora.",
        502,
      );
    }

    const response = NextResponse.json<AuthRegistrationResponse>({
      ok: true,
      data: {
        user: {
          name: user.name,
          cpfMasked: user.cpfMasked,
          email: user.email,
        },
      },
    });

    setAuthCookie(response, createAuthSessionToken(user));

    return response;
  } catch (error) {
    console.error("auth-register-bff-failed", error);

    return errorResponse(
      "registration_unavailable",
      "Nao foi possivel concluir o cadastro agora.",
      502,
    );
  }
}
