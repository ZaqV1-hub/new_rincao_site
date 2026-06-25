import type { Metadata } from "next";
import { PainelCompraConvenioPage } from "@/components/painel-compra-convenio-page";
import { listPainelCompraConvenio } from "@/lib/painel-compra-convenio";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Compra Convenio | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelCompraConvenioPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess(["vis_compra", "vis_conve"], "/painel/compra-convenio");
  const query = await searchParams;
  const filters = Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const result = await listPainelCompraConvenio(filters);

  return <PainelCompraConvenioPage result={result} />;
}
