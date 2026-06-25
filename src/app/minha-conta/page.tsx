import type { Metadata } from "next";
import { CustomerAccountHome } from "@/components/customer-account-home";
import { requireAuthenticatedCustomer } from "@/lib/customer-area";
import { getCustomerAccountSnapshotByCpf } from "@/lib/user-repository";

export const metadata: Metadata = {
  title: "Minha Conta | Estancia",
  description:
    "Resumo da area do cliente do Estancia com sessao atual, pedidos e acesso controlado aos fluxos ainda mantidos no legado.",
  alternates: {
    canonical: "/minha-conta",
  },
};

export const dynamic = "force-dynamic";

export default async function MinhaContaPage() {
  const customer = await requireAuthenticatedCustomer("/minha-conta");
  const snapshot = await getCustomerAccountSnapshotByCpf(customer.cpf);

  if (!snapshot) {
    return null;
  }

  return <CustomerAccountHome snapshot={snapshot} />;
}
