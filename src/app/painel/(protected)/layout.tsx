import { PainelShell } from "@/components/painel-shell";
import { getPainelSessionContext } from "@/lib/painel-session";

export const dynamic = "force-dynamic";

export default async function PainelProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPainelSessionContext();

  if (!session) {
    return children;
  }

  return (
    <PainelShell
      actorName={session.actorName}
      actorCpf={session.actorCpf}
      role={session.role}
      permissions={session.permissions}
      legacyRoleId={session.legacyRoleId}
      legacyRoleName={session.legacyRoleName}
      legacyResources={session.legacyResources}
    >
      {children}
    </PainelShell>
  );
}
