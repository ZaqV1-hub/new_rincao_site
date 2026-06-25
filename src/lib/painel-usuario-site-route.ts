import {
  readRouteActor,
  readRouteParams,
  runOpsRoute,
} from "@/lib/ops-route-utils";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

const PAINEL_USUARIO_SITE_PERMISSIONS = ["vis_situsu"] as const;

type PainelUsuarioSiteRouteParams = Record<string, string>;

type PainelUsuarioSiteRouteContext<TParams extends PainelUsuarioSiteRouteParams> = {
  params: Promise<TParams>;
};

export async function runPainelUsuarioSiteRoute<
  TParams extends PainelUsuarioSiteRouteParams,
  TPayload,
  TResult,
>(
  request: Request,
  context: PainelUsuarioSiteRouteContext<TParams>,
  options: {
    readPayload?: (request: Request) => Promise<TPayload>;
    run: (input: {
      params: TParams;
      payload: TPayload;
      actor: ReturnType<typeof readRouteActor>;
    }) => Promise<TResult>;
    mapError: (error: unknown) => {
      code: string;
      message: string;
      status: number;
    };
    logTag: string;
  },
) {
  const access = await requirePainelApiAccess(request, [...PAINEL_USUARIO_SITE_PERMISSIONS]);

  if (!access.ok) {
    return access.response;
  }

  const params = await readRouteParams(context);
  const payload = options.readPayload
    ? await options.readPayload(request)
    : (undefined as TPayload);
  const actor = readRouteActor({
    name: access.session.actorName,
    cpf: access.session.actorCpf,
  });

  return runOpsRoute(() => options.run({ params, payload, actor }), {
    mapError: options.mapError,
    logTag: options.logTag,
  });
}
