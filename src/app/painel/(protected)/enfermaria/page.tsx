import { EnfermariaDashboard } from "@/components/enfermaria-dashboard";
import { requirePainelAccess } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

export default async function EnfermariaPage() {
  await requirePainelAccess("vis_enfermaria", "/painel/enfermaria");
  return <EnfermariaDashboard />;
}
