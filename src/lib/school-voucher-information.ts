import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";

async function ensureSchoolVoucherInformationTable() {
  const pool = getIngressoSistemaDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS school_voucher_information (
      id smallint PRIMARY KEY CHECK (id = 1),
      text text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function getSchoolVoucherInformation() {
  await ensureSchoolVoucherInformationTable();
  const pool = getIngressoSistemaDbPool();
  const result = await pool.query<{ text: string }>(
    "SELECT text FROM school_voucher_information WHERE id = 1",
  );
  return String(result.rows[0]?.text ?? "").trim();
}

export async function updateSchoolVoucherInformation(value: unknown) {
  const text = String(value ?? "").trim();
  if (text.length > 10000) throw new Error("O texto pode ter no máximo 10.000 caracteres.");

  await ensureSchoolVoucherInformationTable();
  const pool = getIngressoSistemaDbPool();
  await pool.query(
    `INSERT INTO school_voucher_information (id, text, updated_at)
     VALUES (1, $1, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, updated_at = CURRENT_TIMESTAMP`,
    [text],
  );
  return text;
}
