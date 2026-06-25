import { NextResponse } from "next/server";
import { resolveLegacyIngressoRoute } from "@/lib/legacy-public-routes";

type LegacyIngressoRouteContext = {
  params: Promise<{
    slug: string[];
  }>;
};

function jsonError(code: string, message: string, status: number) {
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

async function handleLegacyIngressoRoute(
  request: Request,
  context: LegacyIngressoRouteContext,
) {
  const { slug } = await context.params;
  const resolution = resolveLegacyIngressoRoute(slug);

  if (
    resolution.kind === "redirect" &&
    ["GET", "HEAD"].includes(request.method.toUpperCase())
  ) {
    return new NextResponse(null, {
      headers: {
        location: resolution.destination,
      },
      status: resolution.status,
    });
  }

  if (resolution.kind === "redirect") {
    return jsonError(
      "endpoint_retired",
      "Este endpoint legado de /ingresso foi aposentado. Use a superficie nativa do Next.",
      410,
    );
  }

  if (resolution.kind === "retired") {
    return jsonError(
      resolution.code,
      "Este endpoint legado de /ingresso foi aposentado. Use a superficie nativa do Next.",
      resolution.status,
    );
  }

  return jsonError(
    resolution.code,
    "Rota de /ingresso nao encontrada no Next.",
    resolution.status,
  );
}

export const GET = handleLegacyIngressoRoute;
export const HEAD = handleLegacyIngressoRoute;
export const POST = handleLegacyIngressoRoute;
export const PUT = handleLegacyIngressoRoute;
export const PATCH = handleLegacyIngressoRoute;
export const DELETE = handleLegacyIngressoRoute;
