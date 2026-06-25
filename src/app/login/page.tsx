import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerLoginPage } from "@/components/customer-login-page";
import {
  getAuthenticatedCustomer,
  mapCustomerLoginErrorCode,
  sanitizeCustomerRedirect,
} from "@/lib/customer-area";

export const metadata: Metadata = {
  title: "Area do Cliente - Entrar | Estancia",
  description:
    "Entre na nova area do cliente do Estancia para consultar sessao, compras e vouchers pelo BFF da migracao.",
  alternates: {
    canonical: "/login",
  },
};

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{
    redirect?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = sanitizeCustomerRedirect(
    resolvedSearchParams?.redirect,
  );
  const initialError = mapCustomerLoginErrorCode(resolvedSearchParams?.error);
  const customer = await getAuthenticatedCustomer();

  if (customer) {
    redirect(redirectTo);
  }

  return <CustomerLoginPage redirectTo={redirectTo} initialError={initialError} />;
}
