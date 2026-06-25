import type { Metadata } from "next";
import { CustomerForgotPasswordPage } from "@/components/customer-password-reset-pages";

export const metadata: Metadata = {
  title: "Area do Cliente - Esqueci Minha Senha | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CustomerForgotPasswordRoute() {
  return <CustomerForgotPasswordPage />;
}
