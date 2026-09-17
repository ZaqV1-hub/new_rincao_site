import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";

export class ClientObservationError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function ensureClientObservationsTable() {
  const pool = getIngressoSistemaDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cliente_observacoes (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      idcliente integer NOT NULL REFERENCES clientes(idcliente) ON DELETE CASCADE,
      texto text NOT NULL,
      criado_em timestamp without time zone NOT NULL DEFAULT NOW(),
      criado_por varchar(255)
    )
  `);
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export async function listClientObservations(clientId: number) {
  await ensureClientObservationsTable();
  const pool = getIngressoSistemaDbPool();
  const result = await pool.query<{
    id: number;
    texto: string;
    criado_em: string;
    criado_por: string | null;
  }>(
    `
      SELECT id, texto, criado_em::text, criado_por
      FROM cliente_observacoes
      WHERE idcliente = $1
      ORDER BY criado_em DESC, id DESC
    `,
    [clientId],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    text: row.texto,
    createdAt: row.criado_em,
    createdBy: row.criado_por,
  }));
}

export async function addClientObservation(input: {
  clientId: unknown;
  text: unknown;
  actorName?: string | null;
}) {
  const clientId = Number(input.clientId);
  const text = normalizeText(input.text);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new ClientObservationError("invalid_client", "Cliente inválido.", 400);
  }
  if (!text) {
    throw new ClientObservationError("invalid_observation", "Escreva uma observação.", 400);
  }
  if (text.length > 4000) {
    throw new ClientObservationError("invalid_observation", "A observação pode ter até 4.000 caracteres.", 400);
  }

  await ensureClientObservationsTable();
  const pool = getIngressoSistemaDbPool();
  const result = await pool.query<{ id: number }>(
    `INSERT INTO cliente_observacoes (idcliente, texto, criado_por) VALUES ($1, $2, $3) RETURNING id`,
    [clientId, text, normalizeText(input.actorName) || null],
  );
  return { id: Number(result.rows[0]?.id) };
}

export async function deleteClientObservation(input: { clientId: unknown; observationId: unknown }) {
  const clientId = Number(input.clientId);
  const observationId = Number(input.observationId);
  if (!Number.isInteger(clientId) || clientId <= 0 || !Number.isInteger(observationId) || observationId <= 0) {
    throw new ClientObservationError("invalid_observation", "Observação inválida.", 400);
  }
  await ensureClientObservationsTable();
  const pool = getIngressoSistemaDbPool();
  const result = await pool.query(
    `DELETE FROM cliente_observacoes WHERE id = $1 AND idcliente = $2 RETURNING id`,
    [observationId, clientId],
  );
  if (!result.rows[0]) {
    throw new ClientObservationError("observation_not_found", "Observação não encontrada.", 404);
  }
}
