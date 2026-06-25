import { getIngressoDbPool } from "@/lib/ingresso-db";

type MembershipMaintenanceRow = {
  total: string | null;
};

export type MembershipMaintenanceDomain = "socio" | "convenio" | "conveniado";

export type MembershipMaintenanceItem = {
  domain: MembershipMaintenanceDomain;
  deactivated: number;
};

export type RunMembershipMaintenanceSuccess = {
  action: "membership_maintenance";
  processed: number;
  items: MembershipMaintenanceItem[];
  message: string;
};

class MembershipMaintenanceError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "MembershipMaintenanceError";
    this.code = code;
    this.status = status;
  }
}

export function asMembershipMaintenanceError(error: unknown) {
  if (error instanceof MembershipMaintenanceError) {
    return error;
  }

  return new MembershipMaintenanceError(
    "membership_maintenance_unavailable",
    "Nao foi possivel executar a manutencao de vigencia agora.",
    502,
  );
}

async function deactivateExpiredDomain(domain: MembershipMaintenanceDomain) {
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    let sql = "";

    if (domain === "socio") {
      sql = `
        WITH updated AS (
          UPDATE socio
          SET stsocio = 'ina'
          WHERE stsocio = 'ati'
            AND dtfimsoc < CURRENT_DATE
          RETURNING cpf
        )
        SELECT COUNT(*)::text AS total FROM updated
      `;
    } else if (domain === "convenio") {
      sql = `
        WITH updated AS (
          UPDATE convenio
          SET stconvenio = 'ina'
          WHERE stconvenio = 'ati'
            AND dtfim < CURRENT_DATE
          RETURNING idconvenio
        )
        SELECT COUNT(*)::text AS total FROM updated
      `;
    } else {
      sql = `
        WITH updated AS (
          UPDATE conveniado
          SET stconveniado = 'ina'
          WHERE stconveniado = 'ati'
            AND dtfimado < CURRENT_DATE
          RETURNING cpf
        )
        SELECT COUNT(*)::text AS total FROM updated
      `;
    }

    const result = await client.query<MembershipMaintenanceRow>(sql);

    return Number(result.rows[0]?.total ?? 0);
  } finally {
    client.release();
  }
}

export async function runMembershipMaintenance(): Promise<RunMembershipMaintenanceSuccess> {
  const [socio, convenio, conveniado] = await Promise.all([
    deactivateExpiredDomain("socio"),
    deactivateExpiredDomain("convenio"),
    deactivateExpiredDomain("conveniado"),
  ]);

  const items = [
    { domain: "socio", deactivated: socio },
    { domain: "convenio", deactivated: convenio },
    { domain: "conveniado", deactivated: conveniado },
  ] satisfies MembershipMaintenanceItem[];

  const processed = items.reduce((sum, item) => sum + item.deactivated, 0);

  return {
    action: "membership_maintenance",
    processed,
    items,
    message:
      processed > 0
        ? `${processed} registro(s) inativados por vigencia.`
        : "Nenhum socio, convenio ou conveniado expirado para inativar.",
  };
}
