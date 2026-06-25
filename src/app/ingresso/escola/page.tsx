import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SchoolPurchasePage } from "@/components/school-purchase-page";
import { getAuthenticatedCustomer } from "@/lib/customer-area";
import { resolveSchoolPurchasePresetFromPlink } from "@/lib/school-purchase-link";

const title = "Passeio Estudantil - Compra Online - Estancia";
const description =
  "Entrada dedicada para o fluxo escolar, separada do cadastro institucional de escolas.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/ingresso/escola",
  },
  openGraph: {
    title,
    description,
    url: "/ingresso/escola",
    siteName: "Estancia",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default async function IngressoEscolaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const customer = await getAuthenticatedCustomer();
  const query = await searchParams;
  const rawPlink = query.plink;
  const plink = Array.isArray(rawPlink) ? rawPlink[0] : rawPlink;
  const preset = plink
    ? await resolveSchoolPurchasePresetFromPlink(plink)
    : null;

  if (plink && !preset) {
    notFound();
  }

  return <SchoolPurchasePage user={customer} preset={preset} />;
}
