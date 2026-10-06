import Link from "next/link";
import { EnfermariaClientRecords } from "@/components/enfermaria-link-client";
import { requirePainelAccess } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

export default async function EnfermariaClientProfile({ params }: { params: Promise<{ clientId: string }> }) {
  await requirePainelAccess("vis_enfermaria", "/painel/enfermaria/clientes");
  const { clientId } = await params;
  return <div className="mx-auto grid max-w-5xl gap-5"><Link href="/painel/enfermaria" className="text-sm text-[#176b96]">← Voltar à Enfermaria</Link><EnfermariaClientRecords clientId={Number(clientId)} /></div>;
}
