import type { Metadata } from "next";
import { PainelClientesPage } from "@/components/painel-clientes-page";
import { listPainelClientes } from "@/lib/painel-clientes";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Clientes | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelClientesPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePainelAccess(["vis_clientes", "vis_escola"], "/painel/clientes");
  const query = await searchParams;
  const data = await listPainelClientes(query);

  return <PainelClientesPage data={data} />;
}
