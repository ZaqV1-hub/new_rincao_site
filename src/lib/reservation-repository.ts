import { getIngressoDbPool } from "@/lib/ingresso-db";
import { encodeLegacyId } from "@/lib/agenda-id";
import { generateUniqueVoucherNumber } from "@/lib/voucher-number";

type ReservationQuantities = {
  normal: number;
  child: number;
  exempt: number;
};

type ReservationAgendaRow = {
  idagenda: number;
  vlnormalbil: string | null;
  vlinfantbil: string | null;
};

export class ReservationCreationError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ReservationCreationError";
    this.code = code;
    this.status = status;
  }
}

function normalizeMoney(value: number) {
  return value.toFixed(2);
}

function parseMoney(value: string | null) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

export async function createReservationPurchase(
  cpf: string,
  agendaId: number,
  quantities: ReservationQuantities,
) {
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const agendaResult = await client.query<ReservationAgendaRow>(
      `
        SELECT
          agenda.idagenda,
          tabpreco.vlnormalbil::text AS vlnormalbil,
          tabpreco.vlinfantbil::text AS vlinfantbil
        FROM agenda
        JOIN tabpreco ON tabpreco.idtabpreco = agenda.idtabpreco
        WHERE agenda.idagenda = $1
          AND agenda.tpagenda IN ('padra', 'promo')
          AND agenda.stagenda = 'abe'
        LIMIT 1
      `,
      [agendaId],
    );
    const agenda = agendaResult.rows[0];

    if (!agenda) {
      throw new ReservationCreationError(
        "agenda_not_found",
        "Data de visita indisponivel para reserva.",
        404,
      );
    }

    const normalPrice = parseMoney(agenda.vlnormalbil);
    const childPrice = parseMoney(agenda.vlinfantbil);

    if (normalPrice === null || childPrice === null) {
      throw new ReservationCreationError(
        "reservation_unavailable",
        "Esta data nao aceita reserva com pagamento no parque.",
        409,
      );
    }

    const voucherCount =
      quantities.normal + quantities.child + quantities.exempt;
    const totalValue = normalizeMoney(
      quantities.normal * normalPrice + quantities.child * childPrice,
    );

    const purchaseResult = await client.query<{ idcompra: number }>(
      `
        INSERT INTO compra (
          cpf,
          tpcompra,
          dtcompra,
          hrcompra,
          formapag,
          vltotcompra,
          stcompra
        )
        VALUES (
          $1,
          'reser',
          CURRENT_DATE,
          CURRENT_TIME,
          'N/A',
          $2,
          'conc'
        )
        RETURNING idcompra
      `,
      [cpf, totalValue],
    );
    const purchaseId = purchaseResult.rows[0]?.idcompra;

    if (!purchaseId) {
      throw new Error("purchase_insert_failed");
    }

    for (let index = 0; index < quantities.normal; index += 1) {
      const voucherNumber = await generateUniqueVoucherNumber(client, "A");

      await client.query(
        `
          INSERT INTO voucher (
            idcompra,
            numvoucher,
            idagenda,
            tpvoucher,
            vlunicompra,
            stusado
          )
          VALUES ($1, $2, $3, 'norma', $4, 'n')
        `,
        [purchaseId, voucherNumber, agendaId, normalizeMoney(normalPrice)],
      );
    }

    for (let index = 0; index < quantities.child; index += 1) {
      const voucherNumber = await generateUniqueVoucherNumber(client, "C");

      await client.query(
        `
          INSERT INTO voucher (
            idcompra,
            numvoucher,
            idagenda,
            tpvoucher,
            vlunicompra,
            stusado
          )
          VALUES ($1, $2, $3, 'infan', $4, 'n')
        `,
        [purchaseId, voucherNumber, agendaId, normalizeMoney(childPrice)],
      );
    }

    for (let index = 0; index < quantities.exempt; index += 1) {
      const voucherNumber = await generateUniqueVoucherNumber(client, "I");

      await client.query(
        `
          INSERT INTO voucher (
            idcompra,
            numvoucher,
            idagenda,
            tpvoucher,
            vlunicompra,
            stusado
          )
          VALUES ($1, $2, $3, 'isent', '0.00', 'n')
        `,
        [purchaseId, voucherNumber, agendaId],
      );
    }

    await client.query("COMMIT");

    return {
      purchaseId,
      legacyEncodedId: encodeLegacyId(purchaseId),
      totalValue,
      voucherCount,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
