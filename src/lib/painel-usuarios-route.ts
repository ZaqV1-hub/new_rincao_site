import {
  readRouteActor,
  readRouteParams,
  runOpsRoute,
} from "@/lib/ops-route-utils";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

const PAINEL_USUARIOS_PERMISSIONS = ["vis_usu"] as const;

type PainelUsuariosRouteParams = Record<string, string>;

type PainelUsuariosRouteContext<TParams extends PainelUsuariosRouteParams> = {
  params: Promise<TParams>;
};

export async function authorizePainelUsuariosRoute(request: Request) {
  return requirePainelApiAccess(request, [...PAINEL_USUARIOS_PERMISSIONS]);
}

export async function runPainelUsuariosRoute<
  TParams extends PainelUsuariosRouteParams,
  TPayload,
  TResult,
>(
  request: Request,
  context: PainelUsuariosRouteContext<TParams>,
  options: {
    readPayload?: (request: Request) => Promise<TPayload>;
    run: (input: {
      params: TParams;
      payload: TPayload;
      actor: ReturnType<typeof readRouteActor>;
      sessionCpf: string | null;
    }) => Promise<TResult>;
    mapError: (error: unknown) => {
      code: string;
      message: string;
      status: number;
    };
    logTag: string;
  },
) {
  const access = await authorizePainelUsuariosRoute(request);

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

  return runOpsRoute(
    () =>
      options.run({
        params,
        payload,
        actor,
        sessionCpf: access.session.actorCpf,
      }),
    {
      mapError: options.mapError,
      logTag: options.logTag,
    },
  );
}
