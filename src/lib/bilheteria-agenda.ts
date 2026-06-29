import { Buffer } from "node:buffer";
import {
  normalizeAgendaStatus,
  type PublicAgendaEvent,
  type PublicAgendaStatus,
  type PublicAgendaType,
} from "@/lib/agenda-contracts";
import { getIngressoDbPool } from "@/lib/ingresso-db";

function getSaoPauloToday() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return `${valueByType.get("year")}-${valueByType.get("month")}-${valueByType.get("day")}`;
}

function isBilheteriaAgendaOpen(status: string | null | undefined) {
  return status === "abe" || status === "lot";
}

type BilheteriaAgendaRow = {
  idagenda: number;
  dtagenda: string | null;
  stagenda: string | null;
  tpagenda: string | null;
  nmpromocional: string | null;
  dspromocional: string | null;
  idtabpreco: number | null;
  nmtabpreco: string | null;
  vlnormal: string | null;
  vlinfant: string | null;
  vlnormalbil: string | null;
  vlinfantbil: string | null;
};

function encodeLegacyId(id: number) {
  return Buffer.from(String(id), "utf8").toString("base64");
}

export async function getBilheteriaAgendaStatusToday() {
  const today = getSaoPauloToday();
  const pool = getIngressoDbPool();
  const result = await pool.query<BilheteriaAgendaRow>(
    `
      SELECT
        agenda.idagenda,
        agenda.dtagenda::text AS dtagenda,
        agenda.stagenda,
        agenda.tpagenda,
        agenda.nmpromocional,
        agenda.dspromocional,
        agenda.idtabpreco,
        tabpreco.nmtabpreco,
        tabpreco.vlnormal::text AS vlnormal,
        tabpreco.vlinfant::text AS vlinfant,
        tabpreco.vlnormalbil::text AS vlnormalbil,
        tabpreco.vlinfantbil::text AS vlinfantbil
      FROM agenda
      LEFT JOIN tabpreco ON tabpreco.idtabpreco = agenda.idtabpreco
      WHERE agenda.dtagenda = $1::date
        AND agenda.tpagenda IN ('padra', 'promo')
        AND agenda.stagenda IN ('abe', 'lot')
      ORDER BY agenda.idagenda ASC
    `,
    [today],
  );
  const openAgendas = result.rows
    .map<PublicAgendaEvent>((row) => {
      const date = String(row.dtagenda ?? "").slice(0, 10);
      const [year, month, day] = date.split("-").map(Number);
      const status = String(row.stagenda ?? "").trim() as PublicAgendaStatus;
      const type = String(row.tpagenda ?? "").trim() as PublicAgendaType;

      return {
        id: row.idagenda,
        legacyEncodedId: encodeLegacyId(row.idagenda),
        date,
        day,
        month,
        year,
        status,
        type,
        statusLabel: normalizeAgendaStatus(status),
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
    })
    .filter(
      (agenda) => agenda.date === today && isBilheteriaAgendaOpen(agenda.status),
    );

  return {
    today,
    hasOpenAgendaToday: openAgendas.length > 0,
    openAgendas,
  };
}
