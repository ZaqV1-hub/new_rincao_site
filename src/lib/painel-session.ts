import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listLegacyPanelResourcesForRole } from "@/lib/painel-acl";
import { restrictEnfermariaResources } from "@/lib/enfermaria-access";
import {
  getDefaultPainelPath,
  hasLegacyPanelResource,
  type LegacyPanelResource,
} from "@/lib/painel-access";
import {
  OPERATIONS_COOKIE_NAME,
  verifyOperationsSessionToken,
} from "@/lib/ops-session";

export async function getPainelSessionContext() {
  const cookieStore = await cookies();
  const session = verifyOperationsSessionToken(
    cookieStore.get(OPERATIONS_COOKIE_NAME)?.value ?? null,
  );

  if (!session) {
    return null;
  }

  if (!session.legacyRoleId) {
    return {
      ...session,
      legacyResources: restrictEnfermariaResources(session.legacyResources ?? [], session.actorCpf),
    };
  }

  const dynamicResources = await listLegacyPanelResourcesForRole(session.legacyRoleId);

  return {
    ...session,
    legacyResources: restrictEnfermariaResources(
      dynamicResources.length > 0
        ? dynamicResources
        : (session.legacyResources ?? []), session.actorCpf),
  };
}

export async function requirePainelSession(currentPath = "/painel") {
  const session = await getPainelSessionContext();

  if (!session) {
    redirect(`/painel/login?redirect=${encodeURIComponent(currentPath)}`);
  }

  return session;
}

export async function requirePainelAccess(
  required: LegacyPanelResource | LegacyPanelResource[],
  currentPath: string,
) {
  const session = await requirePainelSession(currentPath);

  if (!hasLegacyPanelResource(session.legacyResources, required)) {
    redirect(getDefaultPainelPath(session.legacyRoleId));
  }

  return session;
}

export async function requireRepresentativeContractSession(currentPath = "/contrato") {
  const session = await requirePainelSession(currentPath);

  if (session.legacyRoleId !== 4) {
    redirect(`/painel/login?redirect=${encodeURIComponent(currentPath)}`);
  }

  return session;
}
