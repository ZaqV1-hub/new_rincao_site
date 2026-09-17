import type { PoolClient } from "pg";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { normalizeSchoolType, type SchoolType } from "@/lib/school-education";

export async function ensureSchoolTypeColumn(client: PoolClient) {
  const column = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'clientes'
          AND column_name = 'tipo_escola'
      ) AS exists
    `,
  );

  if (!column.rows[0]?.exists) {
    await client.query("ALTER TABLE clientes ADD COLUMN tipo_escola varchar(20)");
  }

  await client.query("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS diretoria_ensino varchar(255)");
  await client.query("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS informacoes_escolares text");
}

export function normalizeStoredSchoolType(value: unknown): SchoolType | null {
  return normalizeSchoolType(value);
}

export async function listSchoolsPendingClassification() {
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await ensureSchoolTypeColumn(client);
    const result = await client.query<{ idcliente: number; nome: string }>(
      `
        SELECT idcliente, nome
        FROM clientes
        WHERE idtipo = 4
          AND COALESCE(btrim(tipo_escola), '') = ''
        ORDER BY nome ASC
      `,
    );

    return result.rows.map((row) => ({ id: Number(row.idcliente), name: row.nome }));
  } finally {
    client.release();
  }
}
