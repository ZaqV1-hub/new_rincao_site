import {
  asSchoolContractError,
  createSchoolContract,
} from "@/lib/school-contracts";
import { readJsonPayload, runOpsRoute } from "@/lib/ops-route-utils";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";
import { getActivePublicUserByCpf } from "@/lib/user-repository";

export const runtime = "nodejs";

type ContractPayload = {
  schoolId?: unknown;
  newSchoolName?: unknown;
  visitDate?: unknown;
  representativeId?: unknown;
  representativeName?: unknown;
  representativeEmail?: unknown;
  observation?: unknown;
  responsibleName?: unknown;
  responsiblePhone?: unknown;
  responsibleEmail?: unknown;
};

function getBaseUrlFromRequest(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return url.origin;
}

export async function POST(request: Request) {
  const access = await requirePainelApiAccess(request, "vis_contra");

  if (!access.ok) {
    return access.response;
  }

  if (access.session.legacyRoleId !== 4) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "painel_forbidden",
          message: "Somente representantes podem criar contratos por esta rota.",
        },
      },
      { status: 403 },
    );
  }

  const payload = await readJsonPayload<ContractPayload>(request);
  const actorUser = access.session.actorCpf
    ? await getActivePublicUserByCpf(access.session.actorCpf)
    : null;

  return runOpsRoute(
    () =>
      createSchoolContract({
        schoolId: payload?.schoolId,
        newSchoolName: payload?.newSchoolName,
        visitDate: payload?.visitDate,
        representativeId: payload?.representativeId,
        representativeName: actorUser?.name ?? access.session.actorName,
        representativeEmail: actorUser?.email ?? "",
        observation: payload?.observation,
        responsibleName: payload?.responsibleName,
        responsiblePhone: payload?.responsiblePhone,
        responsibleEmail: payload?.responsibleEmail,
        baseUrl: getBaseUrlFromRequest(request),
        actor: {
          name: access.session.actorName,
          cpf: access.session.actorCpf,
        },
      }),
    {
      mapError: asSchoolContractError,
      logTag: "school-contract-create-failed",
    },
  );
}
