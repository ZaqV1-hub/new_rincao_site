import { beforeEach, describe, expect, it } from "vitest";
import {
  authenticateOperationsJobRequest,
  authenticateOperationsRequest,
  validateOperationsBearerToken,
  validateOperationsJobToken,
} from "@/lib/ops-auth";
import { getPermissionsForOperationsRole } from "@/lib/ops-permissions";
import { createOperationsSessionToken } from "@/lib/ops-session";

describe("ops-auth", () => {
  beforeEach(() => {
    process.env.INGRESSO_OPERATIONS_API_TOKEN = "ops-token";
    process.env.INGRESSO_OPERATIONS_JOBS_TOKEN = "jobs-token";
    process.env.INGRESSO_OPERATIONS_ADMIN_CPFS = "";
    process.env.INGRESSO_OPERATIONS_FINANCE_CPFS = "";
    process.env.INGRESSO_OPERATIONS_OPERATOR_CPFS = "";
    process.env.INGRESSO_OPERATIONS_AUDITOR_CPFS = "";
    process.env.INGRESSO_OPERATIONS_DEFAULT_ROLE = "";
    process.env.INGRESSO_OPERATIONS_API_TOKEN_ROLE = "";
  });

  it("accepts a valid bearer token", () => {
    expect(validateOperationsBearerToken("ops-token")).toBe(true);
    expect(
      authenticateOperationsRequest(
        new Request("https://example.com/api/ops/reference-data", {
          headers: {
            authorization: "Bearer ops-token",
          },
        }),
      ),
    ).toEqual({
      ok: true,
      via: "bearer",
      role: "admin",
      permissions: getPermissionsForOperationsRole("admin"),
      actorName: null,
      actorCpf: null,
    });
  });

  it("limits bearer token permissions when a bearer role is configured", async () => {
    process.env.INGRESSO_OPERATIONS_API_TOKEN_ROLE = "finance";

    const readResult = authenticateOperationsRequest(
      new Request("https://example.com/api/ops/cash-summary", {
        headers: {
          authorization: "Bearer ops-token",
        },
      }),
      {
        requiredPermission: "ops.cash",
      },
    );

    expect(readResult).toEqual({
      ok: true,
      via: "bearer",
      role: "finance",
      permissions: getPermissionsForOperationsRole("finance"),
      actorName: null,
      actorCpf: null,
    });

    const writeResult = authenticateOperationsRequest(
      new Request("https://example.com/api/ops/purchases/cancel", {
        headers: {
          authorization: "Bearer ops-token",
        },
      }),
      {
        requiredPermission: "ops.purchases",
      },
    );

    expect(writeResult.ok).toBe(false);
    if (!writeResult.ok) {
      expect(writeResult.response.status).toBe(403);
      await expect(writeResult.response.json()).resolves.toEqual({
        ok: false,
        error: {
          code: "operations_forbidden",
          message: "Token operacional sem permissao para esta acao.",
        },
      });
    }
  });

  it("accepts a valid operations session cookie", () => {
    const token = createOperationsSessionToken({
      actorName: "Gestor Teste",
      actorCpf: "52998224725",
    });

    expect(
      authenticateOperationsRequest(
        new Request("https://example.com/api/ops/reference-data", {
          headers: {
            cookie: `rincao_ops_session=${token}`,
          },
        }),
      ),
    ).toEqual({
      ok: true,
      via: "session",
      role: "admin",
      permissions: getPermissionsForOperationsRole("admin"),
      actorName: "Gestor Teste",
      actorCpf: "52998224725",
    });
  });

  it("accepts a session cookie even when bearer auth is not configured", () => {
    process.env.INGRESSO_OPERATIONS_API_TOKEN = "";

    const token = createOperationsSessionToken({
      actorName: "Gestor Teste",
      actorCpf: "52998224725",
    });

    expect(
      authenticateOperationsRequest(
        new Request("https://example.com/api/ops/reference-data", {
          headers: {
            cookie: `rincao_ops_session=${token}`,
          },
        }),
      ),
    ).toEqual({
      ok: true,
      via: "session",
      role: "admin",
      permissions: getPermissionsForOperationsRole("admin"),
      actorName: "Gestor Teste",
      actorCpf: "52998224725",
    });
  });

  it("rejects sessions without the required permission", async () => {
    process.env.INGRESSO_OPERATIONS_AUDITOR_CPFS = "52998224725";

    const token = createOperationsSessionToken({
      actorName: "Auditoria",
      actorCpf: "52998224725",
    });
    const result = authenticateOperationsRequest(
      new Request("https://example.com/api/ops/purchases/cancel", {
        headers: {
          cookie: `rincao_ops_session=${token}`,
        },
      }),
      {
        requiredPermission: "ops.purchases",
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({
        ok: false,
        error: {
          code: "operations_forbidden",
          message: "Sessao operacional sem permissao para esta acao.",
        },
      });
    }
  });

  it("rejects invalid bearer tokens even when the session cookie is absent", async () => {
    const result = authenticateOperationsRequest(
      new Request("https://example.com/api/ops/reference-data", {
        headers: {
          authorization: "Bearer wrong-token",
        },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toEqual({
        ok: false,
        error: {
          code: "operations_unauthorized",
          message: "Token operacional ausente ou invalido.",
        },
      });
    }
  });

  it("accepts a valid operations job token", () => {
    expect(validateOperationsJobToken("jobs-token")).toBe(true);
    expect(
      authenticateOperationsJobRequest(
        new Request("https://example.com/api/ops/jobs/daily-run/scheduled", {
          headers: {
            "x-ops-jobs-token": "jobs-token",
          },
        }),
      ),
    ).toEqual({
      ok: true,
    });
  });

  it("rejects invalid operations job tokens", async () => {
    const result = authenticateOperationsJobRequest(
      new Request("https://example.com/api/ops/jobs/daily-run/scheduled", {
        headers: {
          "x-ops-jobs-token": "wrong-token",
        },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toEqual({
        ok: false,
        error: {
          code: "operations_jobs_unauthorized",
          message: "Token de job operacional ausente ou invalido.",
        },
      });
    }
  });
});
