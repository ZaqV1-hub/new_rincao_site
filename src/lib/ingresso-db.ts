import { Pool, type PoolConfig } from "pg";

function getPoolConfig(): PoolConfig {
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

export function getIngressoDbPool() {
  const globalForPg = globalThis as typeof globalThis & {
    __ingressoDbPool?: Pool;
  };

  if (!globalForPg.__ingressoDbPool) {
    globalForPg.__ingressoDbPool = new Pool(getPoolConfig());
  }

  return globalForPg.__ingressoDbPool;
}
