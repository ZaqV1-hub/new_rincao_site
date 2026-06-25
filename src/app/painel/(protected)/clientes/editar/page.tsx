import type { Metadata } from "next";
import { PainelClienteFormPage } from "@/components/painel-cliente-form-page";
import { getPainelClientDetail } from "@/lib/painel-clientes";
import { listClientTypes } from "@/lib/ops-client-education";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Editar Cliente | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelClientesEditarPage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
  }>;
}) {
  await requirePainelAccess(["vis_clientes", "vis_escola"], "/painel/clientes/editar");
  const params = await searchParams;
  const [typeOptions, client] = await Promise.all([
    listClientTypes(),
    getPainelClientDetail(params.id ?? ""),
  ]);

  return (
    <PainelClienteFormPage
      client={client}
      mode="edit"
      typeOptions={typeOptions}
    />
  );
}
