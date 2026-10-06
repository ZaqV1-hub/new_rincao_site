import { EnfermariaPlaces } from "@/components/enfermaria-history";
import { requirePainelAccess } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

export default async function EnfermariaLocaisPage() {
  const session = await requirePainelAccess("vis_enfermaria", "/painel/enfermaria/locais");
  return <EnfermariaPlaces canManage={session.legacyRoleId === 1} />;
}
