import {
  createPool as createMysqlPool,
  type Pool as MysqlPool,
  type PoolConnection as MysqlConnection,
  type PoolOptions as MysqlPoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import {
  Pool as PgPool,
  type Pool as PgPoolType,
  type PoolClient,
  type PoolConfig as PgPoolConfig,
  type QueryResultRow,
} from "pg";

type IngressoDbQueryResult<T extends QueryResultRow = QueryResultRow> = {
  rows: T[];
  rowCount: number;
};

type IngressoDbClient = Pick<PoolClient, "query" | "release">;
type IngressoDbPool = Pick<PgPoolType, "query" | "connect">;

type IngressoDbDialect = "postgres" | "mysql";

type MysqlPreparedQuery = {
  sql: string;
  values: unknown[];
  returningFields: string[] | null;
};

function resolveIngressoDbDialect(): IngressoDbDialect {
  const explicit =
    process.env.INGRESSO_DB_CLIENT ?? process.env.INGRESSO_DB_DIALECT ?? "";
  const normalized = explicit.trim().toLowerCase();

  if (normalized === "mysql") {
    return "mysql";
  }

  if (normalized === "postgres" || normalized === "pg") {
    return "postgres";
  }

  if (process.env.INGRESSO_DATABASE_URL) {
    return "postgres";
  }

  if (
    process.env.WP_DB_HOST ||
    process.env.GROUP_REGISTRATION_MYSQL_HOST ||
    process.env.INGRESSO_DB_HOST?.toLowerCase().includes("mysql")
  ) {
    return "mysql";
  }

  return "postgres";
}

function getPgPoolConfig(): PgPoolConfig {
  const connectionString = process.env.INGRESSO_DATABASE_URL;

  if (connectionString) {
    return {
      connectionString,
      ssl:
        process.env.INGRESSO_DB_SSL === "true"
          ? { rejectUnauthorized: true }
          : undefined,
    };
  }

  return {
    host: process.env.INGRESSO_DB_HOST ?? "127.0.0.1",
    port: Number(process.env.INGRESSO_DB_PORT ?? 54320),
    database: process.env.INGRESSO_DB_NAME ?? "clrincao_sistema",
    user: process.env.INGRESSO_DB_USER ?? "postgres",
    password: process.env.INGRESSO_DB_PASSWORD ?? "postgres",
    max: Number(process.env.INGRESSO_DB_POOL_MAX ?? 4),
    ssl:
      process.env.INGRESSO_DB_SSL === "true"
        ? { rejectUnauthorized: true }
        : undefined,
  };
}

function getMysqlPoolConfig(): MysqlPoolOptions {
  const host = process.env.INGRESSO_DB_HOST ?? process.env.WP_DB_HOST;
  const database = process.env.INGRESSO_DB_NAME ?? process.env.WP_DB_NAME;
  const user = process.env.INGRESSO_DB_USER ?? process.env.WP_DB_USER;
  const password = process.env.INGRESSO_DB_PASSWORD ?? process.env.WP_DB_PASSWORD;
  const port = Number(process.env.INGRESSO_DB_PORT ?? process.env.WP_DB_PORT ?? 3306);
  const sslEnabled =
    process.env.INGRESSO_DB_SSL === "true" ||
    process.env.WP_DB_SSL === "true" ||
    host?.toLowerCase().includes("azure.com");

  if (!host || !database || !user) {
    throw new Error(
      "Configure INGRESSO_DB_HOST/NAME/USER/PASSWORD ou WP_DB_HOST/NAME/USER/PASSWORD para usar o MySQL do painel.",
    );
  }

  return {
    host,
    port,
    database,
    user,
    password,
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: Number(process.env.INGRESSO_DB_POOL_MAX ?? 4),
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  };
}

function normalizeMysqlStatement(sql: string) {
  return sql.replace(/\r\n/g, "\n").trim();
}

function convertPgDateFormatToMysql(format: string) {
  return format
    .replace(/DD/g, "%d")
    .replace(/MM/g, "%m")
    .replace(/YYYY/g, "%Y")
    .replace(/YY/g, "%y");
}

function translateCountFilter(sql: string) {
  return sql.replace(
    /COUNT\(\*\)\s+FILTER\s*\(\s*WHERE\s+([\s\S]*?)\s*\)/gi,
    "SUM(CASE WHEN $1 THEN 1 ELSE 0 END)",
  );
}

function translateToRegclass(
  sql: string,
  values: unknown[],
): { sql: string; values: unknown[] } | null {
  if (!sql.includes("to_regclass")) {
    return null;
  }

  const literalMatch = sql.match(/to_regclass\('([^']+)'\)/i);

  if (literalMatch) {
    const tableName = literalMatch[1]?.split(".").pop() ?? literalMatch[1];

    return {
      sql: `
        SELECT table_name AS regclass
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
        LIMIT 1
      `,
      values: [tableName],
    };
  }

  const paramMatch = sql.match(/to_regclass\(\$(\d+)\)/i);

  if (!paramMatch) {
    return null;
  }

  const parameterIndex = Number(paramMatch[1]) - 1;
  const rawTable = String(values[parameterIndex] ?? "");
  const tableName = rawTable.split(".").pop() ?? rawTable;

  return {
    sql: `
      SELECT table_name AS regclass
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
      LIMIT 1
    `,
    values: [tableName],
  };
}

function buildMysqlPreparedQuery(
  originalSql: string,
  originalValues: unknown[] = [],
): MysqlPreparedQuery {
  const specialRegclass = translateToRegclass(originalSql, originalValues);

  if (specialRegclass) {
    return {
      sql: normalizeMysqlStatement(specialRegclass.sql),
      values: specialRegclass.values,
      returningFields: null,
    };
  }

  let sql = normalizeMysqlStatement(originalSql);
  const values = [...originalValues];
  let returningFields: string[] | null = null;

  const returningMatch = sql.match(/\s+RETURNING\s+(.+?)\s*;?$/i);

  if (returningMatch) {
    returningFields = returningMatch[1]
      .split(",")
      .map((field) => field.trim().replace(/^.*\./, "").replace(/^"|"$/g, ""))
      .filter(Boolean);
    sql = sql.slice(0, returningMatch.index).trimEnd();
  }

  sql = translateCountFilter(sql);
  sql = sql.replace(/\bILIKE\b/gi, "LIKE");
  sql = sql.replace(/\bTRUE\b/g, "1").replace(/\bFALSE\b/g, "0");
  sql = sql.replace(/\bTIMESTAMPTZ\b/gi, "DATETIME");
  sql = sql.replace(/table_schema\s*=\s*'public'/gi, "table_schema = DATABASE()");
  sql = sql.replace(/\s+AT\s+TIME\s+ZONE\s+'[^']+'/gi, "");
  sql = sql.replace(
    /([A-Za-z0-9_."()]+)\s+(ASC|DESC)\s+NULLS\s+LAST/gi,
    "$1 IS NULL, $1 $2",
  );
  sql = sql.replace(
    /date_trunc\(\s*'day'\s*,\s*([^)]+?)\s*\)/gi,
    "DATE($1)",
  );
  sql = sql.replace(
    /to_char\(\s*([^,]+?)\s*,\s*'([^']+)'\s*\)/gi,
    (_, expression: string, pgFormat: string) =>
      `DATE_FORMAT(${expression.trim()}, '${convertPgDateFormatToMysql(pgFormat)}')`,
  );
  sql = sql.replace(
    /TO_DATE\(\s*(\$[0-9]+|'[^']*')\s*,\s*'([^']+)'\s*\)/gi,
    (_, valueRef: string, pgFormat: string) =>
      `STR_TO_DATE(${valueRef}, '${convertPgDateFormatToMysql(pgFormat)}')`,
  );
  sql = sql.replace(
    /CURRENT_DATE\s*-\s*\$([0-9]+)(?:::[a-zA-Z_]+)?/gi,
    "DATE_SUB(CURRENT_DATE, INTERVAL $$__date_sub__$1 DAY)",
  );
  sql = sql.replace(
    /::(?:text|date|time|timestamp(?:tz)?|timestamptz|int(?:eger)?|numeric|decimal|bpchar|varchar\[\]|varchar|char\[\]|char|boolean|smallint|bigint)(?:\[\])?/gi,
    "",
  );

  const expandedValues: unknown[] = [];

  sql = sql.replace(
    /=\s*ANY\(\$([0-9]+)\)/gi,
    (_, positionRaw: string) => {
      const parameterIndex = Number(positionRaw) - 1;
      const parameterValue = values[parameterIndex];
      const list = Array.isArray(parameterValue)
        ? parameterValue
        : parameterValue == null
          ? []
          : [parameterValue];

      if (list.length === 0) {
        return "IN (NULL)";
      }

      expandedValues.push(...list);

      return `IN (${list.map(() => "?").join(", ")})`;
    },
  );

  const orderedValues: unknown[] = [];

  sql = sql.replace(/\$([0-9]+)/g, (_, positionRaw: string) => {
    const parameterIndex = Number(positionRaw) - 1;
    orderedValues.push(values[parameterIndex]);
    return "?";
  });

  sql = sql.replace(/\$\$__date_sub__\? DAY/g, "? DAY");

  const finalValues =
    expandedValues.length > 0
      ? [...expandedValues, ...orderedValues]
      : orderedValues;

  return {
    sql,
    values: finalValues,
    returningFields,
  };
}

function mapMysqlQueryResult<T extends QueryResultRow = QueryResultRow>(
  result: RowDataPacket[] | RowDataPacket[][] | ResultSetHeader,
  returningFields: string[] | null,
): IngressoDbQueryResult<T> {
  if (Array.isArray(result)) {
    const rows = result as T[];
    return {
      rows,
      rowCount: rows.length,
    };
  }

  if (
    returningFields &&
    returningFields.length === 1 &&
    typeof result.insertId === "number" &&
    result.insertId > 0
  ) {
    return {
      rows: [{ [returningFields[0]]: result.insertId } as T],
      rowCount: result.affectedRows ?? 0,
    };
  }

  return {
    rows: [],
    rowCount: result.affectedRows ?? 0,
  };
}

async function executeMysqlQuery<T extends QueryResultRow = QueryResultRow>(
  connection: MysqlPool | MysqlConnection,
  sql: string,
  values?: unknown[],
): Promise<IngressoDbQueryResult<T>> {
  const normalized = normalizeMysqlStatement(sql).toUpperCase();

  if ("beginTransaction" in connection) {
    if (normalized === "BEGIN" || normalized === "START TRANSACTION") {
      await connection.beginTransaction();
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "COMMIT") {
      await connection.commit();
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "ROLLBACK") {
      await connection.rollback();
      return { rows: [], rowCount: 0 };
    }
  }

  const prepared = buildMysqlPreparedQuery(sql, values);
  const [result] = await connection.query(prepared.sql, prepared.values);

  return mapMysqlQueryResult<T>(
    result as RowDataPacket[] | RowDataPacket[][] | ResultSetHeader,
    prepared.returningFields,
  );
}

function createMysqlIngressoDbPool(): IngressoDbPool {
  const globalForMysql = globalThis as typeof globalThis & {
    __ingressoDbMysqlPool?: MysqlPool;
  };

  if (!globalForMysql.__ingressoDbMysqlPool) {
    globalForMysql.__ingressoDbMysqlPool = createMysqlPool(getMysqlPoolConfig());
  }

  const pool = globalForMysql.__ingressoDbMysqlPool;

  const wrapper = {
    query<T extends QueryResultRow = QueryResultRow>(
      sql: string,
      values?: unknown[],
    ) {
      return executeMysqlQuery<T>(pool, sql, values);
    },
    async connect() {
      const connection = await pool.getConnection();

      return {
        query<T extends QueryResultRow = QueryResultRow>(
          sql: string,
          values?: unknown[],
        ) {
          return executeMysqlQuery<T>(connection, sql, values);
        },
        release() {
          connection.release();
        },
      } as unknown as IngressoDbClient;
    },
  };

  return wrapper as unknown as IngressoDbPool;
}

function createPostgresIngressoDbPool(): IngressoDbPool {
  const globalForPg = globalThis as typeof globalThis & {
    __ingressoDbPool?: PgPool;
  };

  if (!globalForPg.__ingressoDbPool) {
    globalForPg.__ingressoDbPool = new PgPool(getPgPoolConfig());
  }

  const pool = globalForPg.__ingressoDbPool;

  const wrapper = {
    async query<T extends QueryResultRow = QueryResultRow>(
      sql: string,
      values?: unknown[],
    ) {
      const result = await pool.query<T>(sql, values);
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? result.rows.length,
      };
    },
    async connect() {
      const client = await pool.connect();

      return {
        async query<T extends QueryResultRow = QueryResultRow>(
          sql: string,
          values?: unknown[],
        ) {
          const result = await client.query<T>(sql, values);
          return {
            rows: result.rows,
            rowCount: result.rowCount ?? result.rows.length,
          };
        },
        release() {
          client.release();
        },
      };
    },
  };

  return wrapper as unknown as IngressoDbPool;
}

export function getIngressoDbPool(): IngressoDbPool {
  return resolveIngressoDbDialect() === "mysql"
    ? createMysqlIngressoDbPool()
    : createPostgresIngressoDbPool();
}
