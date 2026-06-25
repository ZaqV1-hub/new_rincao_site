import { NextResponse } from "next/server";
import type { CustomerProfileResponse } from "@/lib/customer-profile-contracts";
import { clearAuthCookie } from "@/lib/auth-session";
import {
  customerApiErrorResponse,
  readCustomerJsonPayload,
  requireAuthenticatedCustomerSubject,
} from "@/lib/customer-api-route";
import {
  findPublicUserByEmail,
  getActivePublicUserProfileByCpf,
  getProfileCityById,
  listProfileCitiesByUf,
  listProfileUfs,
  updatePublicUserProfile,
} from "@/lib/user-repository";

export const runtime = "nodejs";

type ProfilePayload = {
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

async function readAuthenticatedProfile() {
  const auth = await requireAuthenticatedCustomerSubject(
    getActivePublicUserProfileByCpf,
  );

  if (!auth.ok) {
    return auth;
  }

  return {
    ok: true as const,
    profile: auth.subject,
  };
}

async function buildProfileResponse(cpf: string) {
  const profile = await getActivePublicUserProfileByCpf(cpf);

  if (!profile) {
    return null;
  }

  const [ufs, cities] = await Promise.all([
    listProfileUfs(),
    profile.uf ? listProfileCitiesByUf(profile.uf) : Promise.resolve([]),
  ]);

  return NextResponse.json<CustomerProfileResponse>({
    ok: true,
    data: {
      profile,
      locations: {
        ufs,
        cities,
      },
    },
  });
}

async function parsePayload(request: Request) {
  return readCustomerJsonPayload<ProfilePayload>(request);
}

export async function GET() {
  try {
    const auth = await readAuthenticatedProfile();

    if (!auth.ok) {
      return auth.response;
    }

    const response = await buildProfileResponse(auth.profile.cpf);

    if (!response) {
      const unauthenticated = customerApiErrorResponse(
        "unauthenticated",
        "Sessao nao encontrada ou expirada.",
        401,
      );
      clearAuthCookie(unauthenticated);

      return unauthenticated;
    }

    return response;
  } catch (error) {
    console.error("customer-profile-read-failed", error);

    return customerApiErrorResponse(
      "profile_unavailable",
      "Nao foi possivel consultar o cadastro agora.",
      502,
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await readAuthenticatedProfile();

    if (!auth.ok) {
      return auth.response;
    }

    const payload = await parsePayload(request);

    if (!payload) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Informe os dados do cadastro em JSON.",
        400,
      );
    }

    const name = cleanRequiredText(payload.name, 120);

    if (!name.ok) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Informe um nome completo valido.",
        400,
      );
    }

    const email = cleanRequiredText(payload.email, 120);

    if (!email.ok || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Informe um e-mail valido.",
        400,
      );
    }

    const rg = cleanOptionalText(payload.rg, 10);

    if (!rg.ok) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Informe um RG com ate 10 caracteres.",
        400,
      );
    }

    const birthDate = cleanBirthDate(payload.birthDate);

    if (!birthDate) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Informe uma data de nascimento valida.",
        400,
      );
    }

    const sex = typeof payload.sex === "string" ? payload.sex.trim().toLowerCase() : "";

    if (sex !== "m" && sex !== "f") {
      return customerApiErrorResponse(
        "invalid_profile",
        "Selecione um sexo valido.",
        400,
      );
    }

    const phone = cleanOptionalPhone(payload.phone);

    if (payload.phone && !phone) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Informe um telefone valido.",
        400,
      );
    }

    const mobile = cleanOptionalPhone(payload.mobile);

    if (payload.mobile && !mobile) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Informe um celular valido.",
        400,
      );
    }

    const address = cleanRequiredText(payload.address, 100);

    if (!address.ok) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Informe um endereco valido.",
        400,
      );
    }

    const number = cleanOptionalText(payload.number, 20);

    if (!number.ok || (number.value && !/^\d+$/.test(number.value))) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Informe um numero valido.",
        400,
      );
    }

    const district = cleanRequiredText(payload.district, 50);

    if (!district.ok) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Informe um bairro valido.",
        400,
      );
    }

    const complement = cleanOptionalText(payload.complement, 50);

    if (!complement.ok) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Informe um complemento com ate 50 caracteres.",
        400,
      );
    }

    const cep = cleanCep(payload.cep);

    if (!cep) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Informe um CEP valido.",
        400,
      );
    }

    const uf = typeof payload.uf === "string" ? payload.uf.trim().toUpperCase() : "";
    const cityId =
      typeof payload.cityId === "number" ? payload.cityId : Number(payload.cityId);

    if (!uf) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Selecione um estado valido.",
        400,
      );
    }

    if (!Number.isInteger(cityId) || cityId <= 0) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Selecione uma cidade valida.",
        400,
      );
    }

    const [ufs, city, emailOwner] = await Promise.all([
      listProfileUfs(),
      getProfileCityById(cityId),
      findPublicUserByEmail(email.value),
    ]);

    if (!ufs.some((option) => option.id === uf)) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Selecione um estado valido.",
        400,
      );
    }

    if (!city || city.uf !== uf) {
      return customerApiErrorResponse(
        "invalid_profile",
        "Selecione uma cidade valida para o estado informado.",
        400,
      );
    }

    if (emailOwner && emailOwner.cpf !== auth.profile.cpf) {
      return customerApiErrorResponse(
        "email_in_use",
        "Este e-mail ja esta vinculado a outra conta.",
        409,
      );
    }

    await updatePublicUserProfile(auth.profile.cpf, {
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

    const response = await buildProfileResponse(auth.profile.cpf);

    if (!response) {
      return customerApiErrorResponse(
        "profile_unavailable",
        "Nao foi possivel atualizar o cadastro agora.",
        502,
      );
    }

    return response;
  } catch (error) {
    console.error("customer-profile-update-failed", error);

    return customerApiErrorResponse(
      "profile_unavailable",
      "Nao foi possivel atualizar o cadastro agora.",
      502,
    );
  }
}
