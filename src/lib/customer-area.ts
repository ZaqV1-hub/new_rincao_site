import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth-session";
import { getActivePublicUserByCpf } from "@/lib/user-repository";

const defaultCustomerRedirect = "/minha-conta";
const customerLoginErrorMessages: Record<string, string> = {
  invalid_credentials: "CPF ou senha invalidos.",
  inactive_user: "Este usuario nao esta ativo.",
  auth_unavailable: "Nao foi possivel autenticar agora.",
};

export function sanitizeCustomerRedirect(
  value: string | null | undefined,
  fallback = defaultCustomerRedirect,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function mapCustomerLoginErrorCode(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return customerLoginErrorMessages[value] ?? null;
}

export async function getAuthenticatedCustomer() {
  const session = await getAuthSession();

  if (!session) {
    return null;
  }

  try {
    return await getActivePublicUserByCpf(session.sub);
  } catch (error) {
    console.error("customer-session-lookup-failed", error);
    return null;
  }
}

export async function requireAuthenticatedCustomer(redirectPath: string) {
  const customer = await getAuthenticatedCustomer();

  if (!customer) {
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  return customer;
}
