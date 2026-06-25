import { NextResponse } from "next/server";
import type { CustomerProfilePasswordResponse } from "@/lib/customer-profile-contracts";
import {
  customerApiErrorResponse,
  readCustomerJsonPayload,
  requireAuthenticatedCustomerSubject,
} from "@/lib/customer-api-route";
import {
  checkPublicUserPassword,
  getActivePublicUserByCpf,
  updatePublicUserPassword,
} from "@/lib/user-repository";

export const runtime = "nodejs";

type PasswordPayload = {
  currentPassword?: unknown;
  newPassword?: unknown;
  confirmPassword?: unknown;
  asenha?: unknown;
  senha?: unknown;
  csenha?: unknown;
};

function readPassword(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function parsePayload(request: Request) {
  return readCustomerJsonPayload<PasswordPayload>(request);
}

export async function POST(request: Request) {
  const payload = await parsePayload(request);

  if (!payload) {
    return customerApiErrorResponse(
      "invalid_password_payload",
      "Informe a senha em JSON.",
      400,
    );
  }

  const currentPassword = readPassword(
    payload.currentPassword ?? payload.asenha,
  );
  const newPassword = readPassword(payload.newPassword ?? payload.senha);
  const confirmPassword = readPassword(
    payload.confirmPassword ?? payload.csenha,
  );

  if (
    currentPassword.length < 1 ||
    currentPassword.length > 20 ||
    newPassword.length < 1 ||
    newPassword.length > 20 ||
    confirmPassword.length < 1 ||
    confirmPassword.length > 20
  ) {
    return customerApiErrorResponse(
      "invalid_password",
      "Informe senhas validas com ate 20 caracteres.",
      400,
    );
  }

  if (newPassword !== confirmPassword) {
    return customerApiErrorResponse(
      "password_confirmation_mismatch",
      "A confirmacao da senha deve ser igual a nova senha.",
      400,
    );
  }

  const auth = await requireAuthenticatedCustomerSubject(getActivePublicUserByCpf);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const user = auth.subject;

    const currentPasswordMatches = await checkPublicUserPassword(
      user.cpf,
      currentPassword,
    );

    if (!currentPasswordMatches) {
      return customerApiErrorResponse(
        "invalid_current_password",
        "A senha atual informada nao esta correta.",
        400,
      );
    }

    await updatePublicUserPassword(user.cpf, newPassword);

    return NextResponse.json<CustomerProfilePasswordResponse>({
      ok: true,
      data: {
        updated: true,
      },
    });
  } catch (error) {
    console.error("customer-profile-password-failed", error);

    return customerApiErrorResponse(
      "profile_unavailable",
      "Nao foi possivel alterar a senha agora.",
      502,
    );
  }
}
