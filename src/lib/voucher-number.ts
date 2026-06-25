import { randomInt } from "node:crypto";

const voucherAlphabet = "123456789ABCDEFGHJKMNPQRSTWXYZ";

export async function generateUniqueVoucherNumber(
  client: {
    query: <T>(text: string, values?: unknown[]) => Promise<{ rows: T[] }>;
  },
  prefix: string,
) {
  while (true) {
    let code = prefix;

    for (let index = 0; index < 4; index += 1) {
      code += voucherAlphabet[randomInt(0, voucherAlphabet.length)];
    }

    const existing = await client.query<{ numvoucher: string }>(
      `
        SELECT numvoucher
        FROM voucher
        WHERE numvoucher = $1
        LIMIT 1
      `,
      [code],
    );

    if (!existing.rows[0]) {
      return code;
    }
  }
}
