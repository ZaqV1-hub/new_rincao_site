import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import {
  getLegacyPanelResources,
  normalizeLegacyPanelResource,
  type LegacyPanelResource,
  type LegacyPanelRoleId,
} from "@/lib/painel-access";

type AclRow = {
  idrecurso: string;
};

export async function listLegacyPanelResourcesForRole(
  roleId: LegacyPanelRoleId,
) {
  const pool = getIngressoSistemaDbPool();
  const result = await pool.query<AclRow>(
    `
      SELECT idrecurso
      FROM acl
      WHERE idpapel = $1
      ORDER BY idrecurso ASC
    `,
    [roleId],
  );

  const defaultResources = getLegacyPanelResources(roleId);
  const dynamicResources = Array.from(
    new Set(
      result.rows
        .map((row) => normalizeLegacyPanelResource(row.idrecurso))
        .filter((resource): resource is LegacyPanelResource => resource !== null),
    ),
  );

  if (dynamicResources.length === 0) {
    return defaultResources;
  }

  return Array.from(new Set([...defaultResources, ...dynamicResources]));
}
