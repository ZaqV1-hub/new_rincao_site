import type { PoolClient } from "pg";

// Caller holds the parent purchase lock before checking or validating a ticket.
export async function getChargebackVoucherHold(client: Pick<PoolClient, "query">, purchaseId: number) {
  const result = await client.query<{ id_case: string }>(
    `SELECT id_case FROM chargeback_cases
     WHERE purchase_id = $1
       AND (payload->>'remoteStatus' = 'PENDING'
         OR COALESCE(result_message, '') <> 'A favor do Estabelecimento')
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [purchaseId],
  );
  return result.rows[0]?.id_case ?? null;
}
