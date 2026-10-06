import { EnfermariaIntake } from "@/components/enfermaria-intake";
import { requirePainelAccess } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

export default async function EnfermariaNovoPage() {
  const session = await requirePainelAccess("vis_enfermaria", "/painel/enfermaria/novo");
  return <EnfermariaIntake professional={session.actorName ?? ""} />;
}
