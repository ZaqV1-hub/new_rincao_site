import {
  readRouteActor,
  readRouteParams,
  runOpsRoute,
} from "@/lib/ops-route-utils";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

const PAINEL_SOCIO_PERMISSIONS = ["vis_socio"] as const;

type PainelSocioRouteParams = Record<string, string>;

type PainelSocioRouteContext<TParams extends PainelSocioRouteParams> = {
  params: Promise<TParams>;
};

export async function runPainelSociosRoute<
  TParams extends PainelSocioRouteParams,
  TPayload,
  TResult,
>(
  request: Request,
  context: PainelSocioRouteContext<TParams>,
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
  const access = await requirePainelApiAccess(request, [...PAINEL_SOCIO_PERMISSIONS]);

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
