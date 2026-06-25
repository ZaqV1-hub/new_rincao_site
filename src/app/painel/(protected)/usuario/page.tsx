import type { Metadata } from "next";
import { PainelUsuariosPage } from "@/components/painel-usuarios-page";
import { listPainelUsuarios } from "@/lib/painel-usuarios";
import { requirePainelAccess } from "@/lib/painel-session";

export const metadata: Metadata = {
  title: "Painel - Usuarios | Estancia",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function PainelUsuariosPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePainelAccess("vis_usu", "/painel/usuario");
  const query = await searchParams;
  const data = await listPainelUsuarios(query);

  return (
    <PainelUsuariosPage
      actorCpf={session.actorCpf}
      data={data}
      legacyResources={session.legacyResources}
    />
  );
}
