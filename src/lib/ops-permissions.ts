export type OperationsPermission =
  | "ops.read"
  | "ops.vouchers"
  | "ops.purchases"
  | "ops.cash"
  | "ops.jobs"
  | "ops.admin";

export type OperationsRole = "admin" | "operator" | "finance" | "auditor";

const rolePermissions: Record<OperationsRole, OperationsPermission[]> = {
  admin: [
    "ops.read",
    "ops.vouchers",
    "ops.purchases",
    "ops.cash",
    "ops.jobs",
    "ops.admin",
  ],
  operator: ["ops.read", "ops.vouchers", "ops.purchases", "ops.cash"],
  finance: ["ops.read", "ops.cash", "ops.jobs"],
  auditor: ["ops.read"],
};

function parseCpfList(value: string | undefined) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((entry) => entry.replace(/\D+/g, ""))
      .filter(Boolean),
  );
}

function parseRoleMap(value: string | undefined) {
  const entries = new Map<string, OperationsRole>();
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return entries;
  }

  function addEntry(cpf: unknown, role: unknown) {
    const normalizedCpf = String(cpf ?? "").replace(/\D+/g, "");
    const normalizedRole = normalizeOperationsRole(String(role ?? ""));

    if (normalizedCpf && normalizedRole) {
      entries.set(normalizedCpf, normalizedRole);
    }
  }

  if (rawValue.startsWith("{")) {
    try {
      const parsed = JSON.parse(rawValue) as Record<string, unknown>;

      for (const [cpf, role] of Object.entries(parsed)) {
        addEntry(cpf, role);
      }

      return entries;
    } catch {
      return entries;
    }
  }

  for (const pair of rawValue.split(",")) {
    const [cpf, role] = pair.split(":");

    addEntry(cpf, role);
  }

  return entries;
}

export function normalizeOperationsRole(value: string | undefined | null) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (
    normalized === "admin" ||
    normalized === "operator" ||
    normalized === "finance" ||
    normalized === "auditor"
  ) {
    return normalized as OperationsRole;
  }

  return null;
}

export function getPermissionsForOperationsRole(role: OperationsRole) {
  return [...rolePermissions[role]];
}

export function resolveOperationsRole(actorCpf?: string | null): OperationsRole {
  const normalizedCpf = String(actorCpf ?? "").replace(/\D+/g, "");
  const roleMap = parseRoleMap(process.env.INGRESSO_OPERATIONS_ROLE_MAP);
  const adminCpfs = parseCpfList(process.env.INGRESSO_OPERATIONS_ADMIN_CPFS);
  const financeCpfs = parseCpfList(process.env.INGRESSO_OPERATIONS_FINANCE_CPFS);
  const operatorCpfs = parseCpfList(process.env.INGRESSO_OPERATIONS_OPERATOR_CPFS);
  const auditorCpfs = parseCpfList(process.env.INGRESSO_OPERATIONS_AUDITOR_CPFS);
  const hasRoleConfig =
    roleMap.size > 0 ||
    adminCpfs.size > 0 ||
    financeCpfs.size > 0 ||
    operatorCpfs.size > 0 ||
    auditorCpfs.size > 0;

  if (!hasRoleConfig) {
    return "admin";
  }

  if (normalizedCpf) {
    const mappedRole = roleMap.get(normalizedCpf);

    if (mappedRole) {
      return mappedRole;
    }

    if (adminCpfs.has(normalizedCpf)) {
      return "admin";
    }

    if (financeCpfs.has(normalizedCpf)) {
      return "finance";
    }

    if (operatorCpfs.has(normalizedCpf)) {
      return "operator";
    }

    if (auditorCpfs.has(normalizedCpf)) {
      return "auditor";
    }
  }

  return normalizeOperationsRole(process.env.INGRESSO_OPERATIONS_DEFAULT_ROLE) ?? "auditor";
}

export function hasOperationsPermission(
  permissions: OperationsPermission[],
  permission: OperationsPermission,
) {
  return permissions.includes(permission);
}
