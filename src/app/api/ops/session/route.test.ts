import { beforeEach, describe, expect, it } from "vitest";
import { getPermissionsForOperationsRole } from "@/lib/ops-permissions";
import { createOperationsSessionToken } from "@/lib/ops-session";

describe("ops/session BFF route", () => {
  beforeEach(() => {
    process.env.INGRESSO_OPERATIONS_API_TOKEN = "ops-token";
  });

  it("creates an operations session cookie", async () => {
    const { POST } = await import("@/app/api/ops/session/route");
    const response = await POST(
      new Request("https://example.com/api/ops/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token: "ops-token",
          actorName: "Gestor Teste",
          actorCpf: "52998224725",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("rincao_ops_session=");
    expect(body).toEqual({
      ok: true,
      data: {
        authenticated: true,
        actorName: "Gestor Teste",
        actorCpf: "52998224725",
        role: "admin",
        permissions: getPermissionsForOperationsRole("admin"),
      },
    });
  });

  it("reads the active operations session", async () => {
    const token = createOperationsSessionToken({
      actorName: "Gestor Teste",
      actorCpf: "52998224725",
    });
    const { GET } = await import("@/app/api/ops/session/route");
    const response = await GET(
      new Request("https://example.com/api/ops/session", {
        headers: {
          cookie: `rincao_ops_session=${token}`,
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        authenticated: true,
        actorName: "Gestor Teste",
        actorCpf: "52998224725",
        role: "admin",
        permissions: getPermissionsForOperationsRole("admin"),
      },
    });
  });

  it("clears the operations session cookie", async () => {
    const { DELETE } = await import("@/app/api/ops/session/route");
    const response = await DELETE();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("rincao_ops_session=");
    expect(body).toEqual({
      ok: true,
      data: {
        authenticated: false,
      },
    });
  });

  it("rejects invalid session creation tokens", async () => {
    const { POST } = await import("@/app/api/ops/session/route");
    const response = await POST(
      new Request("https://example.com/api/ops/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token: "wrong-token",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "operations_unauthorized",
        message: "Token operacional ausente ou invalido.",
      },
    });
  });
});
