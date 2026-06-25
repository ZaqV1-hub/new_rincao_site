import type { Metadata } from "next";
import { PainelCompraVouchersPage } from "@/components/painel-compra-vouchers-page";
import { listPainelPurchaseVouchers } from "@/lib/painel-compras";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Vouchers | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelCompraVouchersPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess("vis_compra", "/painel/compras/vouchers");
  const query = await searchParams;
  const result = await listPainelPurchaseVouchers({
    page: Array.isArray(query.page) ? query.page[0] : query.page,
    filters: query,
  });

  return <PainelCompraVouchersPage result={result} />;
}
