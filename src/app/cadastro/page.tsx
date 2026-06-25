import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerRegistrationPage } from "@/components/customer-registration-page";
import {
  getAuthenticatedCustomer,
  sanitizeCustomerRedirect,
} from "@/lib/customer-area";

export const metadata: Metadata = {
  title: "Area do Cliente - Cadastro | Estancia",
  description:
    "Crie sua conta no Estancia para acessar a area do cliente e continuar a jornada de compra.",
  alternates: {
    canonical: "/cadastro",
  },
};

export const dynamic = "force-dynamic";

type CadastroPageProps = {
  searchParams?: Promise<{
    redirect?: string;
  }>;
};

export default async function CadastroPage({ searchParams }: CadastroPageProps) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = sanitizeCustomerRedirect(
    resolvedSearchParams?.redirect,
  );
  const customer = await getAuthenticatedCustomer();

  if (customer) {
    redirect(redirectTo);
  }

  return <CustomerRegistrationPage redirectTo={redirectTo} />;
}
