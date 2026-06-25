import { NextResponse } from "next/server";
import type { AuthErrorResponse } from "@/lib/auth-contracts";
import { getOpsAdminMasterDataResources } from "@/lib/ops-admin-master-data";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import {
  authorizePainelApiAccess,
  filterOpsAdminResourcesByPainelAcl,
} from "@/lib/painel-api-auth";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json<AuthErrorResponse>(
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

export async function GET(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.admin",
  });

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const painelAuth = await authorizePainelApiAccess(request, [
      "vis_agenda",
      "vis_tabpre",
      "vis_info",
      "vis_catsoc",
      "vis_conve",
      "vis_clientes",
      "vis_escola",
      "vis_usu",
      "vis_situsu",
      "vis_socio",
    ]);

    if (!painelAuth.ok) {
      return painelAuth.response;
    }

    return NextResponse.json({
      ok: true,
      data:
        painelAuth.legacyResources.length > 0
          ? filterOpsAdminResourcesByPainelAcl(painelAuth.legacyResources)
          : getOpsAdminMasterDataResources(),
    });
  } catch (error) {
    console.error("ops-admin-master-data-resources-bff-failed", error);

    return errorResponse(
      "ops_admin_master_data_resources_unavailable",
      "Nao foi possivel carregar o catalogo administrativo agora.",
      502,
    );
  }
}
