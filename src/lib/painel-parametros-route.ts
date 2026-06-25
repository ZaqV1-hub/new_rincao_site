import {
  readRouteActor,
  runOpsRoute,
} from "@/lib/ops-route-utils";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

const PAINEL_PARAMETROS_PERMISSIONS = ["vis_param"] as const;

export async function runPainelParametrosRoute<TPayload, TResult>(
  request: Request,
  options: {
    readPayload?: (request: Request) => Promise<TPayload>;
    run: (input: {
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
  const access = await requirePainelApiAccess(request, [...PAINEL_PARAMETROS_PERMISSIONS]);

  if (!access.ok) {
    return access.response;
  }

  const payload = options.readPayload
    ? await options.readPayload(request)
    : (undefined as TPayload);
  const actor = readRouteActor({
    name: access.session.actorName,
    cpf: access.session.actorCpf,
  });

  return runOpsRoute(() => options.run({ payload, actor }), {
    mapError: options.mapError,
    logTag: options.logTag,
  });
}
