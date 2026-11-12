import { getOperationalCatalogPool } from "@/lib/painel-operational-catalog";
import { getOperationalParkId } from "@/lib/operational-day-contract";
import { isCivilDate } from "@/lib/operational-date";
import { DayProgramError, getDayPrograms, type DayProgram } from "@/lib/day-program";

export type DayProgramNavigation = {
  previousDate: string | null; nextDate: string | null;
  dates: { date: string; status: DayProgram["status"] }[];
};
export async function getDayProgramNavigation(date: string): Promise<DayProgramNavigation> {
  if (!isCivilDate(date)) throw new DayProgramError("invalid_input", "Informe uma data civil válida.");
  const result = await getOperationalCatalogPool().query<{ date: string }>(`
    WITH movement AS (
      SELECT DISTINCT a.dtagenda FROM agenda a WHERE
        (a.tpagenda IN ('padra','promo') AND a.stagenda IN ('abe','lot') AND NOT EXISTS (
          SELECT 1 FROM operacao_dias d WHERE d.parque=$2 AND d.data=a.dtagenda AND d.estado='closed'))
        OR EXISTS (SELECT 1 FROM agenda_extras ae WHERE ae.idagenda=a.idagenda)
    ), dates AS (
      (SELECT dtagenda FROM movement WHERE dtagenda<$1::date ORDER BY dtagenda DESC LIMIT 3)
      UNION SELECT $1::date
      UNION (SELECT dtagenda FROM movement WHERE dtagenda>$1::date ORDER BY dtagenda LIMIT 3)
    ) SELECT dates.dtagenda::text AS date FROM dates ORDER BY dates.dtagenda
  `, [date, getOperationalParkId()]);
  const programs = await getDayPrograms(result.rows.map((row) => row.date));
  return {
    previousDate: result.rows.filter((row) => row.date < date).at(-1)?.date ?? null,
    nextDate: result.rows.find((row) => row.date > date)?.date ?? null,
    dates: programs.map(({ date, status }) => ({ date, status })),
  };
}
