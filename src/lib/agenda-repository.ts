import { Buffer } from "node:buffer";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  normalizeAgendaStatus,
  type PublicAgendaEvent,
  type PublicAgendaMonth,
  type PublicAgendaReservationDetail,
  type PublicAgendaStatus,
  type PublicAgendaType,
  type RescheduleAgendaOption,
} from "@/lib/agenda-contracts";

type AgendaRow = {
  idagenda: number;
  dtagenda: Date | string;
  tpagenda: PublicAgendaType;
  stagenda: PublicAgendaStatus;
  nmpromocional: string | null;
  dspromocional: string | null;
  idtabpreco: number | null;
  nmtabpreco: string | null;
  vlnormal: string | null;
  vlinfant: string | null;
  vlnormalbil: string | null;
  vlinfantbil: string | null;
  nudia: number;
  numes: number;
  nuano: number;
};

type AgendaReservationRow = AgendaRow & {
  informacao_texto: string | null;
};

type AgendaMonthRow = {
  numes: number;
  nuano: number;
};

const saoPauloCurrentDateSql = "(now() AT TIME ZONE 'America/Sao_Paulo')::date";

export function isAgendaDateExpired(date: string, now = new Date()) {
  const agendaDate = new Date(`${date}T12:00:00`);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return agendaDate < startOfToday;
}

function toDateString(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function encodeLegacyId(id: number) {
  return Buffer.from(String(id), "utf8").toString("base64");
}

function mapAgendaRow(row: AgendaRow): PublicAgendaEvent {
  return {
    id: row.idagenda,
    legacyEncodedId: encodeLegacyId(row.idagenda),
    date: toDateString(row.dtagenda),
    day: Number(row.nudia),
    month: Number(row.numes),
    year: Number(row.nuano),
    type: row.tpagenda,
    status: row.stagenda,
    statusLabel: normalizeAgendaStatus(row.stagenda),
    priceTable: {
      id: row.idtabpreco,
      name: row.nmtabpreco,
      normal: row.vlnormal,
      child: row.vlinfant,
      gateNormal: row.vlnormalbil,
      gateChild: row.vlinfantbil,
    },
    promotional: {
      name: row.nmpromocional,
      description: row.dspromocional,
    },
  };
}

function mapRescheduleAgendaRow(row: AgendaRow): RescheduleAgendaOption {
  return {
    id: row.idagenda,
    legacyEncodedId: encodeLegacyId(row.idagenda),
    date: toDateString(row.dtagenda),
    day: Number(row.nudia),
    month: Number(row.numes),
    year: Number(row.nuano),
  };
}

function parseAgendaInformation(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function getPublicAgendaEvents(month: number, year: number) {
  const pool = getIngressoDbPool();
  const result = await pool.query<AgendaRow>(
    `
      SELECT
        agenda.idagenda,
        agenda.dtagenda,
        agenda.tpagenda,
        agenda.stagenda,
        agenda.nmpromocional,
        agenda.dspromocional,
        agenda.idtabpreco,
        EXTRACT(DAY FROM agenda.dtagenda)::int AS nudia,
        EXTRACT(MONTH FROM agenda.dtagenda)::int AS numes,
        EXTRACT(YEAR FROM agenda.dtagenda)::int AS nuano,
        tabpreco.nmtabpreco,
        tabpreco.vlnormal::text AS vlnormal,
        tabpreco.vlinfant::text AS vlinfant,
        tabpreco.vlnormalbil::text AS vlnormalbil,
        tabpreco.vlinfantbil::text AS vlinfantbil
      FROM agenda
      JOIN tabpreco ON tabpreco.idtabpreco = agenda.idtabpreco
      WHERE agenda.tpagenda IN ('padra', 'promo')
        AND agenda.stagenda IN ('abe', 'lot')
        AND agenda.dtagenda >= ${saoPauloCurrentDateSql}
        AND EXTRACT(MONTH FROM agenda.dtagenda) = $1
        AND EXTRACT(YEAR FROM agenda.dtagenda) = $2
      ORDER BY agenda.dtagenda ASC, agenda.idagenda ASC
    `,
    [month, year],
  );

  return result.rows.map(mapAgendaRow);
}

export async function getPublicAgendaEventById(id: number) {
  const pool = getIngressoDbPool();
  const result = await pool.query<AgendaRow>(
    `
      SELECT
        agenda.idagenda,
        agenda.dtagenda,
        agenda.tpagenda,
        agenda.stagenda,
        agenda.nmpromocional,
        agenda.dspromocional,
        agenda.idtabpreco,
        EXTRACT(DAY FROM agenda.dtagenda)::int AS nudia,
        EXTRACT(MONTH FROM agenda.dtagenda)::int AS numes,
        EXTRACT(YEAR FROM agenda.dtagenda)::int AS nuano,
        tabpreco.nmtabpreco,
        tabpreco.vlnormal::text AS vlnormal,
        tabpreco.vlinfant::text AS vlinfant,
        tabpreco.vlnormalbil::text AS vlnormalbil,
        tabpreco.vlinfantbil::text AS vlinfantbil
      FROM agenda
      JOIN tabpreco ON tabpreco.idtabpreco = agenda.idtabpreco
      WHERE agenda.idagenda = $1
        AND agenda.tpagenda IN ('padra', 'promo')
        AND agenda.stagenda IN ('abe', 'lot')
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] ? mapAgendaRow(result.rows[0]) : null;
}

export async function getPublicAgendaReservationById(
  id: number,
): Promise<PublicAgendaReservationDetail | null> {
  const pool = getIngressoDbPool();
  const result = await pool.query<AgendaReservationRow>(
    `
      SELECT
        agenda.idagenda,
        agenda.dtagenda,
        agenda.tpagenda,
        agenda.stagenda,
        agenda.nmpromocional,
        agenda.dspromocional,
        agenda.idtabpreco,
        EXTRACT(DAY FROM agenda.dtagenda)::int AS nudia,
        EXTRACT(MONTH FROM agenda.dtagenda)::int AS numes,
        EXTRACT(YEAR FROM agenda.dtagenda)::int AS nuano,
        tabpreco.nmtabpreco,
        tabpreco.vlnormal::text AS vlnormal,
        tabpreco.vlinfant::text AS vlinfant,
        tabpreco.vlnormalbil::text AS vlnormalbil,
        tabpreco.vlinfantbil::text AS vlinfantbil,
        informacao.texto AS informacao_texto
      FROM agenda
      JOIN tabpreco ON tabpreco.idtabpreco = agenda.idtabpreco
      LEFT JOIN informacao ON informacao.idinformacao = agenda.idinformacao
      WHERE agenda.idagenda = $1
        AND agenda.tpagenda IN ('padra', 'promo')
        AND agenda.stagenda = 'abe'
        AND agenda.dtagenda >= ${saoPauloCurrentDateSql}
      LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    ...mapAgendaRow(row),
    information: parseAgendaInformation(row.informacao_texto),
  };
}

export async function getNextPublicAgendaMonth(fromDate = new Date()) {
  const pool = getIngressoDbPool();
  const fromDateString = fromDate.toISOString().slice(0, 10);
  const result = await pool.query<AgendaMonthRow>(
    `
      SELECT
        EXTRACT(MONTH FROM agenda.dtagenda)::int AS numes,
        EXTRACT(YEAR FROM agenda.dtagenda)::int AS nuano
      FROM agenda
      JOIN tabpreco ON tabpreco.idtabpreco = agenda.idtabpreco
      WHERE agenda.tpagenda IN ('padra', 'promo')
        AND agenda.stagenda IN ('abe', 'lot')
        AND agenda.dtagenda >= $1::date
      GROUP BY numes, nuano
      ORDER BY MIN(agenda.dtagenda) ASC
      LIMIT 1
    `,
    [fromDateString],
  );

  const row = result.rows[0];

  return row ? { month: Number(row.numes), year: Number(row.nuano) } : null;
}

export async function getPublicAgendaMonths() {
  const pool = getIngressoDbPool();
  const result = await pool.query<AgendaMonthRow>(
    `
      SELECT
        EXTRACT(MONTH FROM agenda.dtagenda)::int AS numes,
        EXTRACT(YEAR FROM agenda.dtagenda)::int AS nuano
      FROM agenda
      JOIN tabpreco ON tabpreco.idtabpreco = agenda.idtabpreco
      WHERE agenda.tpagenda IN ('padra', 'promo')
        AND agenda.stagenda IN ('abe', 'lot')
        AND agenda.dtagenda >= ${saoPauloCurrentDateSql}
      GROUP BY numes, nuano
      ORDER BY nuano ASC, numes ASC
    `,
  );

  return result.rows.map<PublicAgendaMonth>((row) => ({
    month: Number(row.numes),
    year: Number(row.nuano),
  }));
}

export async function getRescheduleAgendaOptions(fromDate = new Date()) {
  const pool = getIngressoDbPool();
  const fromDateString = fromDate.toISOString().slice(0, 10);
  const result = await pool.query<AgendaRow>(
    `
      SELECT
        agenda.idagenda,
        agenda.dtagenda,
        agenda.tpagenda,
        agenda.stagenda,
        agenda.nmpromocional,
        agenda.dspromocional,
        agenda.idtabpreco,
        EXTRACT(DAY FROM agenda.dtagenda)::int AS nudia,
        EXTRACT(MONTH FROM agenda.dtagenda)::int AS numes,
        EXTRACT(YEAR FROM agenda.dtagenda)::int AS nuano,
        tabpreco.nmtabpreco,
        tabpreco.vlnormal::text AS vlnormal,
        tabpreco.vlinfant::text AS vlinfant,
        tabpreco.vlnormalbil::text AS vlnormalbil,
        tabpreco.vlinfantbil::text AS vlinfantbil
      FROM agenda
      JOIN tabpreco ON tabpreco.idtabpreco = agenda.idtabpreco
      WHERE agenda.tpagenda = 'padra'
        AND agenda.stagenda = 'abe'
        AND agenda.dtagenda >= $1::date
      ORDER BY agenda.dtagenda ASC, agenda.idagenda ASC
    `,
    [fromDateString],
  );

  return result.rows.map(mapRescheduleAgendaRow);
}

export async function getRescheduleAgendaOptionById(id: number) {
  const pool = getIngressoDbPool();
  const result = await pool.query<AgendaRow>(
    `
      SELECT
        agenda.idagenda,
        agenda.dtagenda,
        agenda.tpagenda,
        agenda.stagenda,
        agenda.nmpromocional,
        agenda.dspromocional,
        agenda.idtabpreco,
        EXTRACT(DAY FROM agenda.dtagenda)::int AS nudia,
        EXTRACT(MONTH FROM agenda.dtagenda)::int AS numes,
        EXTRACT(YEAR FROM agenda.dtagenda)::int AS nuano,
        tabpreco.nmtabpreco,
        tabpreco.vlnormal::text AS vlnormal,
        tabpreco.vlinfant::text AS vlinfant,
        tabpreco.vlnormalbil::text AS vlnormalbil,
        tabpreco.vlinfantbil::text AS vlinfantbil
      FROM agenda
      JOIN tabpreco ON tabpreco.idtabpreco = agenda.idtabpreco
      WHERE agenda.idagenda = $1
        AND agenda.tpagenda = 'padra'
        AND agenda.stagenda = 'abe'
        AND agenda.dtagenda >= ${saoPauloCurrentDateSql}
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] ? mapRescheduleAgendaRow(result.rows[0]) : null;
}
