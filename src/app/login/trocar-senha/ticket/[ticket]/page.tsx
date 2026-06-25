import type { Metadata } from "next";
import { CustomerResetPasswordPage } from "@/components/customer-password-reset-pages";
import { getCustomerPasswordResetTicket } from "@/lib/customer-password-reset";

export const metadata: Metadata = {
  title: "Area do Cliente - Trocar Senha | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

type PageProps = {
  params: Promise<{
    ticket: string;
  }>;
};

export default async function CustomerResetPasswordRoute({ params }: PageProps) {
  const { ticket } = await params;
  const status = await getCustomerPasswordResetTicket(ticket);

  return (
    <CustomerResetPasswordPage ticket={ticket} initialValid={status.valid} />
  );
}
