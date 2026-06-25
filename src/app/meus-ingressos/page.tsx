import type { Metadata } from "next";
import { CustomerVouchersPage } from "@/components/customer-vouchers-page";
import { requireAuthenticatedCustomer } from "@/lib/customer-area";
import { getUserVouchersPage } from "@/lib/voucher-repository";

export const metadata: Metadata = {
  title: "Meus Ingressos | Estancia",
  description:
    "Consulta read-only de compras, reservas e vouchers do cliente durante a migracao do Estancia para Next.js.",
  alternates: {
    canonical: "/meus-ingressos",
  },
};

export const dynamic = "force-dynamic";

export default async function MeusIngressosPage() {
  const customer = await requireAuthenticatedCustomer("/meus-ingressos");
  const pageSize = 25;
  const vouchersPage = await getUserVouchersPage(customer.cpf, pageSize, 0);

  return (
    <CustomerVouchersPage
      initialPurchases={vouchersPage.purchases}
      initialTotalPurchases={vouchersPage.totalPurchases}
      pageSize={pageSize}
      user={customer}
    />
  );
}
