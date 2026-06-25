import type { Metadata } from "next";
import { PainelForgotPasswordPage } from "@/components/painel-password-reset-pages";

export const metadata: Metadata = {
  title: "Painel - Esqueci Minha Senha | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PainelForgotPasswordRoute() {
  return <PainelForgotPasswordPage />;
}
