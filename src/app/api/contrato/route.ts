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
  schoolAddress?: unknown;
  visitDate?: unknown;
  representativeId?: unknown;
  representativeName?: unknown;
  representativeEmail?: unknown;
  observation?: unknown;
  responsibleName?: unknown;
  responsiblePhone?: unknown;
  responsibleEmail?: unknown;
  negotiatedValue?: unknown;
};

function getBaseUrlFromRequest(request: Request) {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

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

  const payload = await readJsonPayload<ContractPayload>(request);
  const isRepresentativeSession = access.session.legacyRoleId === 4;

  if (!isRepresentativeSession) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "contract_representative_required",
          message: "Apenas representantes podem acessar este contrato.",
        },
      },
      { status: 403 },
    );
  }

  const actorUser =
    access.session.actorCpf
      ? await getActivePublicUserByCpf(access.session.actorCpf)
      : null;

  return runOpsRoute(
    () =>
      createSchoolContract({
        schoolId: payload?.schoolId,
        newSchoolName: payload?.newSchoolName,
        schoolAddress: payload?.schoolAddress,
        visitDate: payload?.visitDate,
        representativeId: payload?.representativeId,
        representativeName: isRepresentativeSession
          ? actorUser?.name ?? access.session.actorName
          : payload?.representativeName,
        representativeEmail: isRepresentativeSession
          ? actorUser?.email ?? ""
          : payload?.representativeEmail,
        observation: payload?.observation,
        responsibleName: payload?.responsibleName,
        responsiblePhone: payload?.responsiblePhone,
        responsibleEmail: payload?.responsibleEmail,
        negotiatedValue: payload?.negotiatedValue,
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
