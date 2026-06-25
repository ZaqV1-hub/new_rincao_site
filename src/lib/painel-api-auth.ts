import { NextResponse } from "next/server";
import { getOpsAdminMasterDataResources } from "@/lib/ops-admin-master-data";
import { listLegacyPanelResourcesForRole } from "@/lib/painel-acl";
import {
  hasLegacyPanelResource,
  type LegacyPanelResource,
} from "@/lib/painel-access";
import { getOperationsSessionFromRequest } from "@/lib/ops-session";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function painelAuthRequiredResponse() {
  return errorResponse(
    "painel_auth_required",
    "Sessao autenticada do painel obrigatoria para esta rota.",
    401,
  );
}

export async function authorizePainelApiAccess(
  request: Request,
  required: LegacyPanelResource | LegacyPanelResource[],
) {
  const session = getOperationsSessionFromRequest(request);

  if (!session || session.authSource !== "panel") {
    return {
      ok: true as const,
      legacyResources: [] as LegacyPanelResource[],
    };
  }

  if (!session.legacyRoleId) {
    return {
      ok: false as const,
      response: errorResponse(
        "painel_forbidden",
        "Sessao do painel sem permissao para este modulo.",
        403,
      ),
    };
  }

  const dynamicResources = await listLegacyPanelResourcesForRole(session.legacyRoleId);
  const legacyResources =
    dynamicResources.length > 0
      ? dynamicResources
      : ((session.legacyResources ?? []) as LegacyPanelResource[]);

  if (!hasLegacyPanelResource(legacyResources, required)) {
    return {
      ok: false as const,
      response: errorResponse(
        "painel_forbidden",
        "Sessao do painel sem permissao para este modulo.",
        403,
      ),
    };
  }

  return {
    ok: true as const,
    legacyResources,
  };
}

export async function requirePainelApiAccess(
  request: Request,
  required: LegacyPanelResource | LegacyPanelResource[],
) {
  const session = getOperationsSessionFromRequest(request);

  if (!session || session.authSource !== "panel") {
    return {
      ok: false as const,
      response: painelAuthRequiredResponse(),
    };
  }

  const acl = await authorizePainelApiAccess(request, required);

  if (!acl.ok) {
    return acl;
  }

  return {
    ok: true as const,
    legacyResources: acl.legacyResources,
    session,
  };
}

const masterDataAclMap: Record<string, LegacyPanelResource[]> = {
  agenda: ["vis_agenda"],
  "price-tables": ["vis_tabpre"],
  information: ["vis_info", "vis_agenda"],
  "membership-categories": ["vis_catsoc"],
  agreements: ["vis_conve", "vis_compra"],
  clients: ["vis_clientes"],
  schools: ["vis_escola"],
  "internal-users": ["vis_usu"],
  "site-users": ["vis_situsu"],
  members: ["vis_socio"],
};

export function getLegacyResourcesForMasterDataResource(resource: string) {
  return masterDataAclMap[resource] ?? [];
}

export function filterOpsAdminResourcesByPainelAcl(
  legacyResources: readonly LegacyPanelResource[],
) {
  return getOpsAdminMasterDataResources().filter((definition) => {
    const required = getLegacyResourcesForMasterDataResource(definition.resource);

    return required.length === 0 || hasLegacyPanelResource(legacyResources, required);
  });
}
