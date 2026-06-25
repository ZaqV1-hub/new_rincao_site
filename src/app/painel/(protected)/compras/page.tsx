import type { Metadata } from "next";
import { PainelComprasPage } from "@/components/painel-compras-page";
import { listPainelPurchases } from "@/lib/painel-compras";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Compras | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelComprasPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePainelAccess("vis_compra", "/painel/compras");
  const query = await searchParams;
  const result = await listPainelPurchases({
    page: Array.isArray(query.page) ? query.page[0] : query.page,
    filters: query,
  });

  return (
    <PainelComprasPage
      actorCpf={session.actorCpf}
      actorName={session.actorName}
      result={result}
    />
  );
}
