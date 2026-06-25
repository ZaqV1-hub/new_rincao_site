import type { Metadata } from "next";
import { CustomerAccountManagePage } from "@/components/customer-account-manage-page";
import { requireAuthenticatedCustomer } from "@/lib/customer-area";

export const metadata: Metadata = {
  title: "Alterar senha | Estancia",
  alternates: {
    canonical: "/minha-conta/alterar-senha",
  },
};

export const dynamic = "force-dynamic";

export default async function MinhaContaAlterarSenhaPage() {
  const customer = await requireAuthenticatedCustomer("/minha-conta/alterar-senha");

  return <CustomerAccountManagePage mode="password" user={customer} />;
}
