import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { ClientObservationError } from "@/lib/client-observations";

async function ensureSiteUserObservationsTable() {
  const pool = getIngressoSistemaDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuario_site_observacoes (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      cpf varchar(11) NOT NULL,
      texto text NOT NULL,
      criado_em timestamp without time zone NOT NULL DEFAULT NOW(),
      criado_por varchar(255)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS usuario_site_observacoes_cpf_idx ON usuario_site_observacoes (cpf, criado_em DESC)`);
}

function normalizeCpf(value: unknown) {
  const cpf = String(value ?? "").replace(/\D/g, "");
  if (cpf.length !== 11) {
    throw new ClientObservationError("invalid_cpf", "CPF inválido.", 400);
  }
  return cpf;
}

export async function listSiteUserObservations(rawCpf: unknown) {
  const cpf = normalizeCpf(rawCpf);
  await ensureSiteUserObservationsTable();
  const pool = getIngressoSistemaDbPool();
  const result = await pool.query<{
    id: number;
    texto: string;
    criado_em: string;
    criado_por: string | null;
  }>(`
    SELECT id, texto, criado_em::text, criado_por
    FROM usuario_site_observacoes
    WHERE cpf = $1
    ORDER BY criado_em DESC, id DESC
  `, [cpf]);
  return result.rows.map((row) => ({
    id: Number(row.id),
    text: row.texto,
    createdAt: row.criado_em,
    createdBy: row.criado_por,
  }));
}

export async function addSiteUserObservation(input: { cpf: unknown; text: unknown; actorName?: string | null }) {
  const cpf = normalizeCpf(input.cpf);
  const text = String(input.text ?? "").trim();
  if (!text) throw new ClientObservationError("invalid_observation", "Escreva uma observação.", 400);
  if (text.length > 4000) throw new ClientObservationError("invalid_observation", "A observação pode ter até 4.000 caracteres.", 400);
  await ensureSiteUserObservationsTable();
  const pool = getIngressoSistemaDbPool();
  const user = await pool.query<{ cpf: string }>(
    "SELECT cpf FROM usuario WHERE cpf = $1 AND idpapel IS NULL LIMIT 1",
    [cpf],
  );
  if (!user.rows[0]) throw new ClientObservationError("site_user_not_found", "Usuário do site não encontrado.", 404);
  const result = await pool.query<{ id: number }>(
    "INSERT INTO usuario_site_observacoes (cpf, texto, criado_por) VALUES ($1, $2, $3) RETURNING id",
    [cpf, text, String(input.actorName ?? "").trim() || null],
  );
  return { id: Number(result.rows[0]?.id) };
}

export async function deleteSiteUserObservation(input: { cpf: unknown; observationId: unknown }) {
  const cpf = normalizeCpf(input.cpf);
  const observationId = Number(input.observationId);
  if (!Number.isInteger(observationId) || observationId <= 0) {
    throw new ClientObservationError("invalid_observation", "Observação inválida.", 400);
  }
  await ensureSiteUserObservationsTable();
  const pool = getIngressoSistemaDbPool();
  const result = await pool.query(
    "DELETE FROM usuario_site_observacoes WHERE id = $1 AND cpf = $2 RETURNING id",
    [observationId, cpf],
  );
  if (!result.rows[0]) throw new ClientObservationError("observation_not_found", "Observação não encontrada.", 404);
}
