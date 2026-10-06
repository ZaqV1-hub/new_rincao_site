import { EnfermariaRecordForm } from "@/components/enfermaria-record-form";
import { requirePainelAccess } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

export default async function EnfermariaRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, values] = await Promise.all([
    requirePainelAccess("vis_enfermaria", "/painel/enfermaria"),
    params,
  ]);
  return <EnfermariaRecordForm id={Number(values.id)} professional={session.actorName ?? ""} canManage={session.legacyRoleId === 1} />;
}
