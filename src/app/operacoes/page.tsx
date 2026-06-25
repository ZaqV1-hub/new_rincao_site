import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Painel Interno | Estancia",
  description:
    "Entrada legada redirecionada para o novo /painel interno do Estancia.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/painel",
  },
};

export const dynamic = "force-dynamic";

export default function OperacoesPage() {
  redirect("/painel");
}
