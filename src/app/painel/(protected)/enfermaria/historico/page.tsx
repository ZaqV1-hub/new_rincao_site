import { EnfermariaHistory } from "@/components/enfermaria-history";
import { requirePainelAccess } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

export default async function EnfermariaHistoricoPage() {
  await requirePainelAccess("vis_enfermaria", "/painel/enfermaria/historico");
  return <EnfermariaHistory />;
}
