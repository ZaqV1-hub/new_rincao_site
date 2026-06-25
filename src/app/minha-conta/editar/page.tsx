import type { Metadata } from "next";
import { CustomerAccountManagePage } from "@/components/customer-account-manage-page";
import { requireAuthenticatedCustomer } from "@/lib/customer-area";

export const metadata: Metadata = {
  title: "Alterar meus dados | Estancia",
  alternates: {
    canonical: "/minha-conta/editar",
  },
};

export const dynamic = "force-dynamic";

export default async function MinhaContaEditarPage() {
  const customer = await requireAuthenticatedCustomer("/minha-conta/editar");

  return <CustomerAccountManagePage mode="profile" user={customer} />;
}
