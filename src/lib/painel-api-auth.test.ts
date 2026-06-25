import { beforeEach, describe, expect, it, vi } from "vitest";

const getOperationsSessionFromRequest = vi.fn();
const listLegacyPanelResourcesForRole = vi.fn();
const getOpsAdminMasterDataResources = vi.fn();

vi.mock("@/lib/ops-session", () => ({
  getOperationsSessionFromRequest,
}));

vi.mock("@/lib/painel-acl", () => ({
  listLegacyPanelResourcesForRole,
}));

vi.mock("@/lib/ops-admin-master-data", () => ({
  getOpsAdminMasterDataResources,
}));

describe("painel-api-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows non-panel API requests without applying painel ACL", async () => {
    getOperationsSessionFromRequest.mockReturnValue(null);

    const { authorizePainelApiAccess } = await import("@/lib/painel-api-auth");
    const result = await authorizePainelApiAccess(
      new Request("https://example.com/api/ops/admin/master-data/resources"),
      "vis_agenda",
    );

    expect(result).toEqual({
      ok: true,
      legacyResources: [],
    });
    expect(listLegacyPanelResourcesForRole).not.toHaveBeenCalled();
  });

  it("requires a panel-authenticated session when using the strict painel guard", async () => {
    getOperationsSessionFromRequest.mockReturnValue(null);

    const { requirePainelApiAccess } = await import("@/lib/painel-api-auth");
    const result = await requirePainelApiAccess(
      new Request("https://example.com/api/painel/bilheteria/sales"),
      "vis_bilhet",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("allows panel sessions when dynamic ACL includes the requested resource", async () => {
    getOperationsSessionFromRequest.mockReturnValue({
      authSource: "panel",
      legacyRoleId: 1,
      legacyResources: ["vis_usu"],
    });
    listLegacyPanelResourcesForRole.mockResolvedValue(["vis_param", "vis_usu"]);

    const { authorizePainelApiAccess } = await import("@/lib/painel-api-auth");
    const result = await authorizePainelApiAccess(
      new Request("https://example.com/api/ops/admin/parameters"),
      "vis_param",
    );

    expect(result).toEqual({
      ok: true,
      legacyResources: ["vis_param", "vis_usu"],
    });
  });

  it("denies panel sessions when the dynamic ACL lacks the requested resource", async () => {
    getOperationsSessionFromRequest.mockReturnValue({
      authSource: "panel",
      legacyRoleId: 2,
      legacyResources: ["vis_bilhet"],
    });
    listLegacyPanelResourcesForRole.mockResolvedValue(["vis_bilhet"]);

    const { authorizePainelApiAccess } = await import("@/lib/painel-api-auth");
    const result = await authorizePainelApiAccess(
      new Request("https://example.com/api/ops/admin/parameters"),
      "vis_param",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns the panel session when using the strict painel guard", async () => {
    getOperationsSessionFromRequest.mockReturnValue({
      authSource: "panel",
      actorName: "Operador",
      actorCpf: "52998224725",
      legacyRoleId: 1,
      legacyResources: ["vis_bilhet"],
    });
    listLegacyPanelResourcesForRole.mockResolvedValue(["vis_bilhet"]);

    const { requirePainelApiAccess } = await import("@/lib/painel-api-auth");
    const result = await requirePainelApiAccess(
      new Request("https://example.com/api/painel/bilheteria/sales"),
      "vis_bilhet",
    );

    expect(result).toEqual({
      ok: true,
      legacyResources: ["vis_bilhet"],
      session: expect.objectContaining({
        authSource: "panel",
        actorName: "Operador",
      }),
    });
  });

  it("filters the administrative catalog by painel ACL resources", async () => {
    getOpsAdminMasterDataResources.mockReturnValue([
      { resource: "agenda" },
      { resource: "price-tables" },
      { resource: "internal-users" },
    ]);

    const { filterOpsAdminResourcesByPainelAcl } = await import(
      "@/lib/painel-api-auth"
    );
    const filtered = filterOpsAdminResourcesByPainelAcl(["vis_agenda", "vis_usu"]);

    expect(filtered).toEqual([{ resource: "agenda" }, { resource: "internal-users" }]);
  });
});
