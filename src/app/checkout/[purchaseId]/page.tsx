import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerCheckoutPage } from "@/components/customer-checkout-page";
import { resolveCheckoutMode } from "@/lib/checkout-mode";
import { buildCheckoutReturnUrl } from "@/lib/checkout-status";
import { isCielo3dsConfigured } from "@/lib/cielo-3ds";
import { getActivePublicUserProfileByCpf } from "@/lib/user-repository";
import { requireAuthenticatedCustomer } from "@/lib/customer-area";
import { getSiteUrl } from "@/lib/site-metadata";
import { getUserVoucherPurchaseById } from "@/lib/voucher-repository";

export const metadata: Metadata = {
  title: "Checkout | Estancia",
  description: "Checkout seguro do Estancia para compra de ingressos.",
};

export const dynamic = "force-dynamic";

type CheckoutRoutePageProps = {
  params: Promise<{
    purchaseId: string;
  }>;
};

export default async function CheckoutRoutePage({
  params,
}: CheckoutRoutePageProps) {
  const { purchaseId } = await params;
  const customer = await requireAuthenticatedCustomer(`/checkout/${purchaseId}`);
  const numericPurchaseId = Number(purchaseId);

  if (!Number.isInteger(numericPurchaseId) || numericPurchaseId <= 0) {
    notFound();
  }

  const purchase = await getUserVoucherPurchaseById(customer.cpf, numericPurchaseId);

  if (!purchase || purchase.type !== "ponli" || purchase.status === "canc") {
    notFound();
  }

  const profile = await getActivePublicUserProfileByCpf(customer.cpf);

  return (
    <CustomerCheckoutPage
      mode={resolveCheckoutMode()}
      purchase={purchase}
      user={customer}
      customer={{
        name: customer.name,
        email: customer.email,
        cpf: customer.cpf,
        phone: profile?.mobile ?? profile?.phone ?? null,
      }}
      returnUrl={buildCheckoutReturnUrl(purchase.id, getSiteUrl())}
      threeDsEnabled={isCielo3dsConfigured()}
    />
  );
}
