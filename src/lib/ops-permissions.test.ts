import { beforeEach, describe, expect, it } from "vitest";
import {
  getPermissionsForOperationsRole,
  resolveOperationsRole,
} from "@/lib/ops-permissions";

describe("ops-permissions", () => {
  beforeEach(() => {
    delete process.env.INGRESSO_OPERATIONS_ROLE_MAP;
    delete process.env.INGRESSO_OPERATIONS_ADMIN_CPFS;
    delete process.env.INGRESSO_OPERATIONS_FINANCE_CPFS;
    delete process.env.INGRESSO_OPERATIONS_OPERATOR_CPFS;
    delete process.env.INGRESSO_OPERATIONS_AUDITOR_CPFS;
    delete process.env.INGRESSO_OPERATIONS_DEFAULT_ROLE;
  });

  it("keeps admin access as the local default without role configuration", () => {
    expect(resolveOperationsRole("529.982.247-25")).toBe("admin");
    expect(getPermissionsForOperationsRole("admin")).toEqual([
      "ops.read",
      "ops.vouchers",
      "ops.purchases",
      "ops.cash",
      "ops.jobs",
      "ops.admin",
    ]);
  });

  it("resolves roles from the compact CPF role map", () => {
    process.env.INGRESSO_OPERATIONS_ROLE_MAP =
      "529.982.247-25:finance,11122233344:operator";

    expect(resolveOperationsRole("52998224725")).toBe("finance");
    expect(resolveOperationsRole("111.222.333-44")).toBe("operator");
  });

  it("resolves roles from a JSON CPF role map", () => {
    process.env.INGRESSO_OPERATIONS_ROLE_MAP = JSON.stringify({
      "529.982.247-25": "auditor",
      "11122233344": "admin",
    });

    expect(resolveOperationsRole("52998224725")).toBe("auditor");
    expect(resolveOperationsRole("111.222.333-44")).toBe("admin");
  });

  it("gives the role map precedence over legacy role lists", () => {
    process.env.INGRESSO_OPERATIONS_ROLE_MAP = "52998224725:auditor";
    process.env.INGRESSO_OPERATIONS_ADMIN_CPFS = "52998224725";

    expect(resolveOperationsRole("529.982.247-25")).toBe("auditor");
  });

  it("falls back to the configured default role when a configured map does not match", () => {
    process.env.INGRESSO_OPERATIONS_ROLE_MAP = "52998224725:operator";
    process.env.INGRESSO_OPERATIONS_DEFAULT_ROLE = "finance";

    expect(resolveOperationsRole("11122233344")).toBe("finance");
  });
});
