import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getPermissionsForOperationsRole,
  resolveOperationsRole,
  type OperationsPermission,
  type OperationsRole,
} from "@/lib/ops-permissions";
import type {
  LegacyPanelResource,
  LegacyPanelRoleId,
  LegacyPanelRoleName,
} from "@/lib/painel-access";

export const OPERATIONS_COOKIE_NAME = "rincao_ops_session";

const SESSION_VERSION = 1;
const SESSION_TTL_SECONDS = 60 * 60 * 8;

type OperationsSessionPayload = {
  v: number;
  scope: "operations";
  authSource?: "token" | "panel";
  actorName: string | null;
  actorCpf: string | null;
  role: OperationsRole;
  permissions: OperationsPermission[];
  legacyRoleId?: LegacyPanelRoleId | null;
  legacyRoleName?: LegacyPanelRoleName | null;
  legacyResources?: LegacyPanelResource[];
  iat: number;
  exp: number;
};

type OperationsSessionInput = {
  actorName?: string | null;
  actorCpf?: string | null;
  role?: OperationsRole;
  permissions?: OperationsPermission[];
  authSource?: "token" | "panel";
  legacyRoleId?: LegacyPanelRoleId | null;
  legacyRoleName?: LegacyPanelRoleName | null;
  legacyResources?: LegacyPanelResource[];
};

type PanelSessionUserInput = {
  name: string;
  cpf: string;
  roleId: LegacyPanelRoleId | null;
  roleName: LegacyPanelRoleName | null;
  operationsRole: OperationsRole | null;
  permissions: OperationsPermission[];
  legacyResources: LegacyPanelResource[];
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSessionSecret() {
  const secret =
    process.env.INGRESSO_OPERATIONS_SESSION_SECRET ||
    process.env.INGRESSO_BFF_SESSION_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "INGRESSO_OPERATIONS_SESSION_SECRET or INGRESSO_BFF_SESSION_SECRET must be configured",
    );
  }

  return "local-rincao-ops-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function safeEqual(first: string, second: string) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  if (firstBuffer.length !== secondBuffer.length) {
    return false;
  }

  return timingSafeEqual(firstBuffer, secondBuffer);
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeCpfDigits(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  return digits || null;
}

function readCookieValue(cookieHeader: string, name: string) {
  const prefix = `${name}=`;
  const item = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!item) {
    return null;
  }

  return item.slice(prefix.length) || null;
}

export function createOperationsSessionToken(input?: OperationsSessionInput) {
  const now = Math.floor(Date.now() / 1000);
  const actorCpf = normalizeCpfDigits(input?.actorCpf);
  const role = input?.role ?? resolveOperationsRole(actorCpf);
  const payload: OperationsSessionPayload = {
    v: SESSION_VERSION,
    scope: "operations",
    authSource: input?.authSource ?? "token",
    actorName: normalizeOptionalText(input?.actorName),
    actorCpf,
    role,
    permissions: input?.permissions ?? getPermissionsForOperationsRole(role),
    legacyRoleId: input?.legacyRoleId ?? null,
    legacyRoleName: input?.legacyRoleName ?? null,
    legacyResources: input?.legacyResources ?? [],
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function createPanelSessionToken(user: PanelSessionUserInput) {
  if (!user.roleId || !user.roleName || !user.operationsRole) {
    throw new Error("Panel user is missing a valid legacy role.");
  }

  return createOperationsSessionToken({
    authSource: "panel",
    actorName: user.name,
    actorCpf: user.cpf,
    role: user.operationsRole,
    permissions: user.permissions,
    legacyRoleId: user.roleId,
    legacyRoleName: user.roleName,
    legacyResources: user.legacyResources,
  });
}

export function verifyOperationsSessionToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !safeEqual(sign(encodedPayload), signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload),
    ) as OperationsSessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (
      payload.v !== SESSION_VERSION ||
      payload.scope !== "operations" ||
      !payload.role ||
      !Array.isArray(payload.permissions) ||
      !payload.exp ||
      payload.exp <= now
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getOperationsSessionFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = readCookieValue(cookieHeader, OPERATIONS_COOKIE_NAME);

  return verifyOperationsSessionToken(token);
}

export function setOperationsSessionCookie(
  response: NextResponse,
  token: string,
) {
  response.cookies.set(OPERATIONS_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearOperationsSessionCookie(response: NextResponse) {
  response.cookies.set(OPERATIONS_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
