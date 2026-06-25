import { NextResponse } from "next/server";

type PasswordResetTicketResult = {
  valid: boolean;
};

type PasswordResetMutationResult = {
  ok: boolean;
};

type PasswordResetRouteOptions = {
  readTicket: (ticket: string) => Promise<PasswordResetTicketResult>;
  resetPassword: (input: {
    ticket: string;
    password: string;
  }) => Promise<PasswordResetMutationResult>;
  logKey: string;
};

type RouteContext = {
  params: Promise<{
    ticket: string;
  }>;
};

type ResetPayload = {
  senha?: unknown;
  csenha?: unknown;
};

function errorResponse(code: string, message: string, status: number) {
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

async function readPayload(request: Request) {
  try {
    return (await request.json()) as ResetPayload;
  } catch {
    return null;
  }
}

export async function readPasswordResetTicketRoute(
  request: Request,
  context: RouteContext,
  options: PasswordResetRouteOptions,
) {
  void request;
  const { ticket } = await context.params;
  const result = await options.readTicket(ticket);

  return NextResponse.json({
    ok: true,
    data: {
      valid: result.valid,
    },
  });
}

export async function submitPasswordResetTicketRoute(
  request: Request,
  context: RouteContext,
  options: PasswordResetRouteOptions,
) {
  const { ticket } = await context.params;
  const payload = await readPayload(request);
  const password = typeof payload?.senha === "string" ? payload.senha : "";
  const confirmPassword = typeof payload?.csenha === "string" ? payload.csenha : "";

  if (!password || password.length > 120) {
    return errorResponse("invalid_password", "Senha invalida.", 400);
  }

  if (confirmPassword !== password) {
    return errorResponse(
      "password_confirmation_mismatch",
      "O campo confirmar deve conter um valor igual ao campo senha.",
      400,
    );
  }

  try {
    const result = await options.resetPassword({
      ticket,
      password,
    });

    if (!result.ok) {
      return errorResponse(
        "invalid_ticket",
        "Ticket para troca de senha invalido.",
        404,
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        changed: true,
      },
    });
  } catch (error) {
    console.error(options.logKey, error);

    return errorResponse(
      "password_reset_unavailable",
      "Nao foi possivel alterar a senha agora.",
      502,
    );
  }
}

export function createPasswordResetTicketRouteHandlers(
  options: PasswordResetRouteOptions,
) {
  return {
    GET(request: Request, context: RouteContext) {
      return readPasswordResetTicketRoute(request, context, options);
    },
    POST(request: Request, context: RouteContext) {
      return submitPasswordResetTicketRoute(request, context, options);
    },
  };
}
