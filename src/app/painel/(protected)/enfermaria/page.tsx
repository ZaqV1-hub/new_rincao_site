import { EnfermariaDashboard } from "@/components/enfermaria-dashboard";
import { requirePainelAccess } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

export default async function EnfermariaPage() {
  const session = await requirePainelAccess("vis_enfermaria", "/painel/enfermaria");
  return <EnfermariaDashboard canManage={session.legacyRoleId === 1} />;
}
