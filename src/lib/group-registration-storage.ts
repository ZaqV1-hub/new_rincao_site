import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  createPool,
  type Pool,
  type PoolOptions,
  type ResultSetHeader,
} from "mysql2/promise";
import type { RegistrationSubmissionInput } from "@/lib/group-registration-form-data";

type RegistrationRecord = RegistrationSubmissionInput & {
  protocol: string;
  createdAt: string;
  ip: string | null;
  userAgent: string | null;
};

type MysqlStorageConfig = {
  poolOptions: string | PoolOptions;
  submitsTable: string;
  submitTimesTable: string;
};

type RegistrationStorage = "mysql-cfdb" | "file" | "file-fallback";

const cfdbFieldMap: Array<{
  fieldName: string;
  getValue: (record: RegistrationRecord) => string;
}> = [
  { fieldName: "nome-grupo", getValue: (record) => record.groupName },
  { fieldName: "nome-coordenador", getValue: (record) => record.coordinatorName },
  { fieldName: "data", getValue: (record) => record.birthDate },
  { fieldName: "your-phone", getValue: (record) => record.phone },
  { fieldName: "celular", getValue: (record) => record.mobile },
  { fieldName: "your-email", getValue: (record) => record.email },
  { fieldName: "sexo", getValue: (record) => record.sex },
  { fieldName: "conheceu", getValue: (record) => record.howHeard },
  { fieldName: "endereco", getValue: (record) => record.address },
  { fieldName: "numero", getValue: (record) => record.number },
  { fieldName: "cep", getValue: (record) => record.cep },
  { fieldName: "bairro", getValue: (record) => record.district },
  { fieldName: "complemento", getValue: (record) => record.complement },
  { fieldName: "cidade", getValue: (record) => record.city },
  { fieldName: "estado", getValue: (record) => record.state },
  { fieldName: "data", getValue: (record) => record.interestDate },
  { fieldName: "your-message", getValue: (record) => record.message },
  { fieldName: "protocolo", getValue: (record) => record.protocol },
  { fieldName: "pagina", getValue: (record) => record.pageTitle },
  { fieldName: "slug", getValue: (record) => record.slug },
  { fieldName: "ip", getValue: (record) => record.ip ?? "" },
  { fieldName: "user_agent", getValue: (record) => record.userAgent ?? "" },
];

function buildProtocol() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = randomUUID().slice(0, 8).toUpperCase();

  return `GRP-${stamp}-${suffix}`;
}

function buildSubmitTime(createdAt: string) {
  const date = new Date(createdAt);
  const seconds = Math.floor(date.getTime() / 1000);
  const millisecondFraction = (date.getMilliseconds() * 10).toString().padStart(4, "0");

  return `${seconds}.${millisecondFraction}`;
}

function getStorageDir() {
  const configuredDir = process.env.GROUP_REGISTRATION_STORAGE_DIR;

  if (configuredDir) {
    return configuredDir;
  }

  return ".data/group-registrations";
}

function getMysqlStorageConfig(): MysqlStorageConfig | null {
  const databaseUrl =
    process.env.GROUP_REGISTRATION_DATABASE_URL ??
    process.env.GROUP_REGISTRATION_MYSQL_URL;

  const tablePrefix = process.env.GROUP_REGISTRATION_WP_TABLE_PREFIX ?? "rincaowp_";
  const submitsTable =
    process.env.GROUP_REGISTRATION_CFDB_TABLE ?? `${tablePrefix}cf7dbplugin_submits`;
  const submitTimesTable =
    process.env.GROUP_REGISTRATION_CFDB_ST_TABLE ?? `${tablePrefix}cf7dbplugin_st`;

  if (databaseUrl) {
    return {
      poolOptions: databaseUrl,
      submitsTable,
      submitTimesTable,
    };
  }

  const host = process.env.GROUP_REGISTRATION_MYSQL_HOST ?? process.env.WP_DB_HOST;
  const database =
    process.env.GROUP_REGISTRATION_MYSQL_DATABASE ?? process.env.WP_DB_NAME;
  const user = process.env.GROUP_REGISTRATION_MYSQL_USER ?? process.env.WP_DB_USER;
  const password =
    process.env.GROUP_REGISTRATION_MYSQL_PASSWORD ?? process.env.WP_DB_PASSWORD;

  if (!host || !database || !user) {
    return null;
  }

  return {
    poolOptions: {
      host,
      port: Number(process.env.GROUP_REGISTRATION_MYSQL_PORT ?? 3306),
      database,
      user,
      password,
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: Number(
        process.env.GROUP_REGISTRATION_MYSQL_CONNECTION_LIMIT ?? 4,
      ),
      ssl:
        process.env.GROUP_REGISTRATION_MYSQL_SSL === "true"
          ? { rejectUnauthorized: true }
          : undefined,
    },
    submitsTable,
    submitTimesTable,
  };
}

function assertSafeMysqlIdentifier(identifier: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe MySQL identifier: ${identifier}`);
  }
}

function getMysqlPool(config: MysqlStorageConfig) {
  const globalForMysql = globalThis as typeof globalThis & {
    __groupRegistrationMysqlPool?: Pool;
  };

  if (!globalForMysql.__groupRegistrationMysqlPool) {
    globalForMysql.__groupRegistrationMysqlPool =
      typeof config.poolOptions === "string"
        ? createPool(config.poolOptions)
        : createPool(config.poolOptions);
  }

  return globalForMysql.__groupRegistrationMysqlPool;
}

async function storeFileRecord(record: RegistrationRecord) {
  const dir = `${getStorageDir()}/${record.createdAt.slice(0, 10)}`;

  await mkdir(dir, { recursive: true });
  await writeFile(
    `${dir}/${record.protocol}.json`,
    JSON.stringify(record, null, 2),
    "utf8",
  );
}

async function storeMysqlCfdbRecord(
  config: MysqlStorageConfig,
  record: RegistrationRecord,
) {
  assertSafeMysqlIdentifier(config.submitsTable);
  assertSafeMysqlIdentifier(config.submitTimesTable);

  const pool = getMysqlPool(config);
  const connection = await pool.getConnection();
  const submitTime = buildSubmitTime(record.createdAt);

  try {
    await connection.beginTransaction();
    await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO \`${config.submitTimesTable}\` (submit_time) VALUES (?)`,
      [submitTime],
    );

    for (const [index, field] of cfdbFieldMap.entries()) {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO \`${config.submitsTable}\`
          (submit_time, form_name, field_name, field_value, field_order)
         VALUES (?, ?, ?, ?, ?)`,
        [
          submitTime,
          record.pageTitle,
          field.fieldName,
          field.getValue(record),
          index,
        ],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function storeRegistrationSubmission(
  input: RegistrationSubmissionInput,
  metadata: {
    ip: string | null;
    userAgent: string | null;
  },
) {
  const protocol = buildProtocol();
  const createdAt = new Date().toISOString();
  const record: RegistrationRecord = {
    ...input,
    protocol,
    createdAt,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
  };

  let storage: RegistrationStorage = "file";
  const mysqlConfig = getMysqlStorageConfig();

  if (mysqlConfig) {
    try {
      await storeMysqlCfdbRecord(mysqlConfig, record);
      storage = "mysql-cfdb";
    } catch (error) {
      if (process.env.GROUP_REGISTRATION_REQUIRE_DATABASE === "true") {
        throw error;
      }

      console.error("group-registration-mysql-save-failed", error);
      await storeFileRecord(record);
      storage = "file-fallback";
    }
  } else {
    await storeFileRecord(record);
  }

  return {
    protocol,
    createdAt,
    storage,
  };
}
