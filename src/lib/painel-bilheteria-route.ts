import {
  authorizeOpsRouteAccess,
  readRouteParams,
  runOpsRoute,
  readRouteActor,
} from "@/lib/ops-route-utils";
import { requirePainelApiAccess } from "@/lib/painel-api-auth";

const PAINEL_BILHETERIA_PERMISSIONS = ["vis_bilhet"] as const;

type PainelBilheteriaRouteParams = Record<string, string>;

type PainelBilheteriaRouteContext<TParams extends PainelBilheteriaRouteParams> = {
  params: Promise<TParams>;
};

export async function authorizePainelBilheteriaOpsRoute(request: Request) {
  return authorizeOpsRouteAccess(request, {
    requiredPermission: "ops.purchases",
    painelPermissions: PAINEL_BILHETERIA_PERMISSIONS,
  });
}

export async function authorizePainelBilheteriaRoute(request: Request) {
  return requirePainelApiAccess(request, [...PAINEL_BILHETERIA_PERMISSIONS]);
}

export async function runPainelBilheteriaOpsRoute<
  TParams extends PainelBilheteriaRouteParams,
  TPayload,
  TResult,
>(
  request: Request,
  context: PainelBilheteriaRouteContext<TParams>,
  options: {
    readPayload?: (request: Request) => Promise<TPayload>;
    run: (input: { params: TParams; payload: TPayload }) => Promise<TResult>;
    mapError: (error: unknown) => {
      code: string;
      message: string;
      status: number;
    };
    logTag: string;
  },
) {
  const access = await authorizePainelBilheteriaOpsRoute(request);

  if (!access.ok) {
    return access.response;
  }

  const params = await readRouteParams(context);
  const payload = options.readPayload
    ? await options.readPayload(request)
    : (undefined as TPayload);

  return runOpsRoute(() => options.run({ params, payload }), {
    mapError: options.mapError,
    logTag: options.logTag,
  });
}

export async function runPainelBilheteriaRoute<
  TParams extends PainelBilheteriaRouteParams,
  TPayload,
  TResult,
>(
  request: Request,
  context: PainelBilheteriaRouteContext<TParams>,
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
  const access = await authorizePainelBilheteriaRoute(request);

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
