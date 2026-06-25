import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SchoolPurchasePage } from "@/components/school-purchase-page";
import { getAuthenticatedCustomer } from "@/lib/customer-area";
import { resolveSchoolPurchasePresetFromPlink } from "@/lib/school-purchase-link";

const title = "Passeio Estudantil - Compra Online (Educador) - Estancia";
const description =
  "Entrada dedicada para compra publica de educador vinculada a passeios escolares.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/ingresso/educador",
  },
  openGraph: {
    title,
    description,
    url: "/ingresso/educador",
    siteName: "Estancia",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default async function IngressoEducadorPage({
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

  return <SchoolPurchasePage user={customer} mode="educator" preset={preset} />;
}
