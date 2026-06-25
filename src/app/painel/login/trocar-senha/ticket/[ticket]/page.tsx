import type { Metadata } from "next";
import { PainelResetPasswordPage } from "@/components/painel-password-reset-pages";
import { getPainelPasswordResetTicket } from "@/lib/painel-password-reset";

export const metadata: Metadata = {
  title: "Painel - Trocar Senha | Estancia",
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

export default async function PainelResetPasswordRoute({ params }: PageProps) {
  const { ticket } = await params;
  const status = await getPainelPasswordResetTicket(ticket);

  return (
    <PainelResetPasswordPage ticket={ticket} initialValid={status.valid} />
  );
}
