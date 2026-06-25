import {
  readRouteActor,
  readRouteParams,
  runOpsRoute,
} from "@/lib/ops-route-utils";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

const PAINEL_CLIENTES_PERMISSIONS = ["vis_clientes", "vis_escola"] as const;

type PainelClientesRouteParams = Record<string, string>;

type PainelClientesRouteContext<TParams extends PainelClientesRouteParams> = {
  params: Promise<TParams>;
};

export async function authorizePainelClientesRoute(request: Request) {
  return requirePainelApiAccess(request, [...PAINEL_CLIENTES_PERMISSIONS]);
}

export async function runPainelClientesRoute<
  TParams extends PainelClientesRouteParams,
  TPayload,
  TResult,
>(
  request: Request,
  context: PainelClientesRouteContext<TParams>,
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
  const access = await authorizePainelClientesRoute(request);

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
