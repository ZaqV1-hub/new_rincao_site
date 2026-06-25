import type { PoolClient } from "pg";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";

type ParameterActor = {
  name?: string | null;
  cpf?: string | null;
};

export type OpsAdminParameterDefinition = {
  group: "msgper" | "segadm";
  id: "codval" | "codven" | "codine" | "codcash";
  label: string;
  description: string;
  defaultValue: string;
  input: "textarea" | "password";
  required: boolean;
};

export type OpsAdminParameterValue = OpsAdminParameterDefinition & {
  value: string;
  persisted: boolean;
};

export type OpsAdminParameterUpdate = {
  group?: string | null;
  id?: string | null;
  value?: string | null;
};

export type OpsAdminParametersUpdateInput = {
  reason?: string | null;
  actor?: ParameterActor | null;
  parameters?: OpsAdminParameterUpdate[] | null;
};

class OpsAdminParametersError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "OpsAdminParametersError";
    this.code = code;
    this.status = status;
  }
}

const parameterDefinitions: OpsAdminParameterDefinition[] = [
  {
    group: "msgper",
    id: "codval",
    label: "Codigo valido",
    description: "Mensagem exibida quando um codigo de indicacao valido e aplicado.",
    defaultValue:
      "O c&oacute;digo de indica&ccedil;&atilde;o ##cod## do(a) representante ##rep## foi aplicado",
    input: "textarea",
    required: true,
  },
  {
    group: "msgper",
    id: "codven",
    label: "Codigo vencido",
    description: "Mensagem exibida quando um codigo de indicacao esta vencido.",
    defaultValue: "O c&oacute;digo de indica&ccedil;&atilde;o ##cod## est&aacute; vencido",
    input: "textarea",
    required: true,
  },
  {
    group: "msgper",
    id: "codine",
    label: "Codigo inexistente",
    description: "Mensagem exibida quando um codigo de indicacao nao e localizado.",
    defaultValue: "N&atilde;o localizamos o c&oacute;digo de indica&ccedil;&atilde;o ##cod##",
    input: "textarea",
    required: true,
  },
  {
    group: "segadm",
    id: "codcash",
    label: "Senha cashback",
    description: "Senha administrativa usada para registrar pagamentos de cashback.",
    defaultValue: "",
    input: "password",
    required: false,
  },
];

export function getOpsAdminParameterDefinitions() {
  return parameterDefinitions.map((definition) => ({ ...definition }));
}

export function asOpsAdminParametersError(error: unknown) {
  if (error instanceof OpsAdminParametersError) {
    return error;
  }

  return new OpsAdminParametersError(
    "admin_parameters_unavailable",
    "Nao foi possivel atualizar os parametros administrativos agora.",
    502,
  );
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeActorName(actor: ParameterActor | null | undefined) {
  return normalizeText(actor?.name) || normalizeText(actor?.cpf) || null;
}

function findDefinition(group: string | null | undefined, id: string | null | undefined) {
  const normalizedGroup = normalizeText(group);
  const normalizedId = normalizeText(id);

  return parameterDefinitions.find(
    (definition) =>
      definition.group === normalizedGroup && definition.id === normalizedId,
  );
}

function normalizeParameterUpdate(update: OpsAdminParameterUpdate) {
  const definition = findDefinition(update.group, update.id);

  if (!definition) {
    throw new OpsAdminParametersError(
      "invalid_admin_parameter",
      "Informe um parametro administrativo valido.",
      400,
    );
  }

  const value = normalizeText(update.value) || definition.defaultValue;

  if (definition.required && !value) {
    throw new OpsAdminParametersError(
      "invalid_admin_parameter",
      "Parametro obrigatorio sem valor.",
      400,
    );
  }

  return {
    definition,
    value,
  };
}

async function listPersistedParameters(client: PoolClient) {
  const ids = parameterDefinitions.map((definition) => definition.id);
  const result = await client.query<{
    idparametro: string;
    grparametro: string | null;
    vlparametro: string | null;
  }>(
    `
      SELECT idparametro, grparametro, vlparametro
      FROM parametro
      WHERE idparametro = ANY($1::text[])
    `,
    [ids],
  );

  return new Map(
    result.rows.map((row) => [
      `${row.grparametro ?? "msgper"}:${row.idparametro}`,
      row.vlparametro ?? "",
    ]),
  );
}

export async function listOpsAdminParameters() {
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    const persisted = await listPersistedParameters(client);

    return parameterDefinitions.map<OpsAdminParameterValue>((definition) => {
      const key = `${definition.group}:${definition.id}`;
      const value = persisted.get(key);

      return {
        ...definition,
        value: value ?? definition.defaultValue,
        persisted: value !== undefined,
      };
    });
  } finally {
    client.release();
  }
}

export async function updateOpsAdminParameters(
  input: OpsAdminParametersUpdateInput,
) {
  const updates = Array.isArray(input.parameters) ? input.parameters : [];

  if (updates.length === 0) {
    throw new OpsAdminParametersError(
      "invalid_admin_parameters_payload",
      "Informe ao menos um parametro para atualizar.",
      400,
    );
  }

  const normalizedUpdates = updates.map(normalizeParameterUpdate);
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const update of normalizedUpdates) {
      await client.query(
        `
          INSERT INTO parametro (idparametro, grparametro, vlparametro)
          VALUES ($1, $2, $3)
          ON CONFLICT (idparametro)
          DO UPDATE SET grparametro = EXCLUDED.grparametro,
                        vlparametro = EXCLUDED.vlparametro
        `,
        [update.definition.id, update.definition.group, update.value],
      );
    }

    const auditLogId = await registerOpsAuditLog(client, {
      origem: "ops-admin",
      acao: "parameters_update",
      descricao: "Parametros administrativos atualizados no BFF.",
      motivo:
        normalizeText(input.reason) ||
        "Atualizacao operacional de parametros administrativos no BFF",
      usuarioNome: normalizeActorName(input.actor),
      detalhes: {
        parameters: normalizedUpdates.map((update) => ({
          group: update.definition.group,
          id: update.definition.id,
        })),
      },
    });

    const persisted = await listPersistedParameters(client);
    const parameters = parameterDefinitions.map<OpsAdminParameterValue>(
      (definition) => {
        const key = `${definition.group}:${definition.id}`;
        const value = persisted.get(key);

        return {
          ...definition,
          value: value ?? definition.defaultValue,
          persisted: value !== undefined,
        };
      },
    );

    await client.query("COMMIT");

    return {
      action: "update" as const,
      parameters,
      auditLogId,
      message: "Parametros atualizados com sucesso.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
