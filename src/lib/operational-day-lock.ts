import type { PoolClient } from "pg";
import type { OperationalParkId } from "@/lib/operational-day-contract";

type QueryClient = Pick<PoolClient, "query">;

// The same key must be used by day-use writers and voucher admission before reading the date.
export async function lockOperationalDay(client: QueryClient, park: OperationalParkId, date: string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`operational-day:${park}:${date}`]);
}

