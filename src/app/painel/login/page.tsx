import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PainelLoginPage } from "@/components/painel-login-page";
import {
  OPERATIONS_COOKIE_NAME,
  verifyOperationsSessionToken,
} from "@/lib/ops-session";
import { getDefaultPainelPath } from "@/lib/painel-access";
import {
  mapPainelLoginErrorCode,
  resolvePainelRecaptchaSiteKey,
  sanitizePainelRedirect,
} from "@/lib/painel-login";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";

export const metadata: Metadata = {
  title: "Painel - Entrar | Estancia",
  description: "Entrada do novo painel interno operacional do Estancia.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/painel/login",
  },
};

export const dynamic = "force-dynamic";

type PainelLoginPageProps = {
  searchParams?: Promise<{
    redirect?: string;
    error?: string;
  }>;
};

export default async function PainelLoginRoute({
  searchParams,
}: PainelLoginPageProps) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = verifyOperationsSessionToken(
    cookieStore.get(OPERATIONS_COOKIE_NAME)?.value ?? null,
  );
  const resolvedSearchParams = await searchParams;
  const redirectTo = sanitizePainelRedirect(resolvedSearchParams?.redirect);
  const initialError = mapPainelLoginErrorCode(resolvedSearchParams?.error);
  const requestHost =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const requestProtocol = headerStore.get("x-forwarded-proto") ?? "http";
  const requestUrl = requestHost
    ? `${requestProtocol}://${requestHost}/painel/login`
    : null;

  if (session) {
    redirect(
      redirectTo === "/painel"
        ? getDefaultPainelPath(session.legacyRoleId)
        : redirectTo,
    );
  }

  return (
    <PainelLoginPage
      redirectTo={redirectTo}
      initialError={initialError}
      recaptchaSiteKey={resolvePainelRecaptchaSiteKey(
        getRecaptchaSiteKey(),
        requestUrl,
      )}
    />
  );
}
