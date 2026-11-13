import type { PoolClient } from 'pg';
import { getOperationalParkId } from './operational-day-contract';
import { lockOperationalDay } from './operational-day-lock';
import { isCivilDate } from './operational-date';
import { TripSettlementError } from './trip-settlement-contract';
import type { TripKey } from './trip-settlement-source';
/** Caller owns the transaction; acquire before agenda, purchase or vehicle locks. */
export async function lockLegacyTripChange(client: Pick<PoolClient,'query'>,key: TripKey,options: { targetDate?: string; structural?: boolean } = {}) {
  const park = getOperationalParkId();
  const initial = (await client.query<{ date: string }>('SELECT dtagenda::text AS date FROM agenda WHERE idagenda=$1',[key.agendaId])).rows[0];
  if (!initial || !isCivilDate(initial.date)) throw new TripSettlementError('trip_not_found','Passeio não encontrado.',404);
  const dates = [...new Set([initial.date,...(options.targetDate ? [options.targetDate] : [])])].sort();
  for (const date of dates) { if (!isCivilDate(date)) throw new TripSettlementError('trip_invalid_date','Data inválida.',400); await lockOperationalDay(client,park,date); }
  if ((await client.query("SELECT data FROM operacao_dias WHERE parque=$1 AND data=ANY($2::date[]) AND estado='closed'",[park,dates])).rowCount) throw new TripSettlementError('trip_day_closed','O dia está finalizado. Solicite revisão gerencial antes de alterar o passeio.');
  const fresh = (await client.query<{ date: string }>('SELECT dtagenda::text AS date FROM agenda WHERE idagenda=$1 FOR UPDATE',[key.agendaId])).rows[0];
  if (fresh?.date !== initial.date) throw new TripSettlementError('trip_source_changed','A data mudou. Confira o passeio antes de tentar novamente.');
  const operation = (await client.query<{ receipt: string | null }>(`SELECT to_jsonb(o)->>'finalized_receipt_id' AS receipt FROM passeio_operacao o WHERE parque=$1 AND agenda_id=$2 AND cliente_id=$3 FOR UPDATE`,[park,key.agendaId,key.clientId])).rows[0];
  if (operation?.receipt) throw new TripSettlementError('trip_finalized','O passeio possui recibo finalizado. Solicite revisão financeira antes de alterar seus dados.');
  if (options.structural && operation) throw new TripSettlementError('trip_operational_history','Este passeio possui programação ou contagem operacional. A mudança de data ou vínculo exige ajuste explícito para preservar o histórico.');
}
