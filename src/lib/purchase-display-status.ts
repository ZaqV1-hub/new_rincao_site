// Keep the persisted purchase status intact for reconciliation and legacy reports.
export function purchaseDisplayStatusSql(alias: "compra" | "c") {
  return `CASE WHEN ${alias}.tpcompra = 'ponli' AND ${alias}.stcompra = 'pend'
    AND (${alias}.dtcompra + ${alias}.hrcompra) <= (NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '12 hours'
    THEN 'expi' ELSE ${alias}.stcompra END`;
}
