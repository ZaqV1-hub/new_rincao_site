import type { Metadata } from "next";
import { PainelClienteFormPage } from "@/components/painel-cliente-form-page";
import { listClientTypes } from "@/lib/ops-client-education";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Adicionar Cliente | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PainelClientesAdicionarPage() {
  await requirePainelAccess(["vis_clientes", "vis_escola"], "/painel/clientes/adicionar");
  const typeOptions = await listClientTypes();

  return <PainelClienteFormPage mode="create" typeOptions={typeOptions} />;
}
