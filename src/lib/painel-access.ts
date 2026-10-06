import {
  getPermissionsForOperationsRole,
  type OperationsPermission,
  type OperationsRole,
} from "@/lib/ops-permissions";

export type LegacyPanelRoleId = 1 | 2 | 3 | 4 | 5;

export type LegacyPanelRoleName =
  | "Gerente"
  | "Funcionario"
  | "Bilheteria"
  | "Representante"
  | "Enfermeiro(a)";

export type LegacyPanelResource =
  | "vis_usu"
  | "vis_situsu"
  | "vis_tabpre"
  | "vis_catsoc"
  | "vis_socio"
  | "vis_conve"
  | "vis_agenda"
  | "vis_info"
  | "vis_compra"
  | "vis_escola"
  | "vis_indica"
  | "vis_param"
  | "vis_desc"
  | "vis_cort"
  | "vis_ingesp"
  | "vis_clientes"
  | "vis_bilhet"
  | "vis_contra"
  | "vis_enfermaria";

const allLegacyPanelResources: LegacyPanelResource[] = [
  "vis_usu",
  "vis_situsu",
  "vis_tabpre",
  "vis_catsoc",
  "vis_socio",
  "vis_conve",
  "vis_agenda",
  "vis_info",
  "vis_compra",
  "vis_escola",
  "vis_indica",
  "vis_param",
  "vis_desc",
  "vis_cort",
  "vis_ingesp",
  "vis_clientes",
  "vis_bilhet",
  "vis_contra",
  "vis_enfermaria",
];

const legacyPanelResources: Record<LegacyPanelRoleId, LegacyPanelResource[]> = {
  1: [
    "vis_usu",
    "vis_situsu",
    "vis_tabpre",
    "vis_catsoc",
    "vis_socio",
    "vis_conve",
    "vis_agenda",
    "vis_info",
    "vis_compra",
    "vis_escola",
    "vis_indica",
    "vis_param",
    "vis_desc",
    "vis_cort",
    "vis_ingesp",
    "vis_clientes",
    "vis_bilhet",
    "vis_contra",
    "vis_enfermaria",
  ],
  2: [
    "vis_agenda",
    "vis_info",
    "vis_tabpre",
    "vis_compra",
    "vis_clientes",
    "vis_situsu",
    "vis_bilhet",
  ],
  3: ["vis_bilhet"],
  4: ["vis_contra"],
  5: ["vis_enfermaria"],
};

export function isLegacyPanelRoleId(value: number | null | undefined): value is LegacyPanelRoleId {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function getLegacyPanelRoleName(roleId: LegacyPanelRoleId): LegacyPanelRoleName {
  if (roleId === 1) {
    return "Gerente";
  }

  if (roleId === 2) {
    return "Funcionario";
  }

  if (roleId === 3) {
    return "Bilheteria";
  }

  if (roleId === 4) {
    return "Representante";
  }

  return "Enfermeiro(a)";
}

export function getLegacyPanelResources(roleId: LegacyPanelRoleId): LegacyPanelResource[] {
  return [...legacyPanelResources[roleId]];
}

export function normalizeLegacyPanelResource(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();

  return allLegacyPanelResources.includes(normalized as LegacyPanelResource)
    ? (normalized as LegacyPanelResource)
    : null;
}

export function getAllLegacyPanelResources() {
  return [...allLegacyPanelResources];
}

export function mapLegacyPanelRoleToOperationsRole(roleId: LegacyPanelRoleId): OperationsRole {
  return roleId === 1 ? "admin" : "operator";
}

export function getOperationsPermissionsForLegacyPanelRole(
  roleId: LegacyPanelRoleId,
): OperationsPermission[] {
  return getPermissionsForOperationsRole(mapLegacyPanelRoleToOperationsRole(roleId));
}

export function getDefaultPainelPath(roleId: LegacyPanelRoleId | null | undefined) {
  if (roleId === 3) {
    return "/painel/bilheteria";
  }

  if (roleId === 5) {
    return "/painel/enfermaria";
  }

  return "/painel";
}

export function hasLegacyPanelResource(
  resources: readonly string[] | null | undefined,
  required: LegacyPanelResource | LegacyPanelResource[],
) {
  const available = new Set(resources ?? []);
  const requiredList = Array.isArray(required) ? required : [required];

  return requiredList.some((resource) => available.has(resource));
}
