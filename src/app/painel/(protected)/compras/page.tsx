import type { Metadata } from "next";
import { PainelComprasPage } from "@/components/painel-compras-page";
import {
  listPainelPurchases,
  normalizePainelPurchaseListFilters,
  type PainelPurchaseListResult,
} from "@/lib/painel-compras";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Compras | Rincao",
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
  let loadErrorMessage: string | null = null;
  let result: PainelPurchaseListResult;

  try {
    result = await listPainelPurchases({
      page: Array.isArray(query.page) ? query.page[0] : query.page,
      filters: query,
    });
  } catch (error) {
    console.error("painel-compras-page-load-failed", error);
    loadErrorMessage =
      "Nao foi possivel carregar as compras com os filtros informados agora. Ajuste a busca e tente novamente.";
    result = {
      items: [],
      total: 0,
      page: 1,
      perPage: 30,
      totalPages: 1,
      filters: normalizePainelPurchaseListFilters(query),
    };
  }

  return (
    <PainelComprasPage
      actorCpf={session.actorCpf}
      actorName={session.actorName}
      loadErrorMessage={loadErrorMessage}
      result={result}
    />
  );
}

