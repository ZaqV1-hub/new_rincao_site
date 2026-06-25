import { getIngressoDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import {
  getAgendaProductAvailability,
  removeAgendaProductAvailability,
  setAgendaProductAvailabilityRange,
} from "@/lib/painel-agenda-product-availability";
import { formatPainelAgendaDateLabel } from "@/lib/painel-agenda-ui";

export type PainelAgendaType =
  | "padra"
  | "promo"
  | "escol"
  | "igrej"
  | "casam"
  | "melho"
  | "confr"
  | "ongs"
  | "grmix";

export type PainelAgendaStatus = "abe" | "fec" | "lot";

export type PainelAgendaMonthEntry = {
  id: number;
  date: string;
  day: number;
  month: number;
  year: number;
  type: PainelAgendaType;
  typeLabel: string;
  status: PainelAgendaStatus;
  statusLabel: string;
  priceTableId: number | null;
  priceTableName: string | null;
  normalValue: string | null;
  childValue: string | null;
  informationId: number | null;
  informationName: string | null;
  promotionName: string | null;
  promotionDescription: string | null;
};

export type PainelAgendaVoucherEntry = {
  purchaseId: number;
  customerName: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  voucherNumber: string | null;
  voucherType: string | null;
  voucherTypeLabel: string;
  unitValue: string | null;
  useDate: string | null;
  used: boolean;
};

export type PainelAgendaOption = {
  id: number;
  label: string;
};

export type PainelAgendaDayDetail = {
  selectedDate: string;
  agenda: PainelAgendaMonthEntry | null;
  vouchers: PainelAgendaVoucherEntry[];
  selectedPassportIds: string[];
  selectedAddonIds: string[];
};

export type PainelAgendaScreenData = {
  month: number;
  year: number;
  entries: PainelAgendaMonthEntry[];
  selectedDate: string | null;
  selectedDay: PainelAgendaDayDetail | null;
  priceTables: PainelAgendaOption[];
  informationOptions: PainelAgendaOption[];
};

export type PainelAgendaRangePreview = {
  existingDates: string[];
  hasSchoolDates: boolean;
};

export type PainelAgendaMutationInput = {
  agendaId?: number | null;
  startDate: string;
  endDate: string;
  priceTableId: number;
  informationId: number;
  type: PainelAgendaType;
  status: PainelAgendaStatus;
  promotionName?: string | null;
  promotionDescription?: string | null;
  passportIds?: string[] | null;
  addonIds?: string[] | null;
  confirmOverwrite?: boolean;
  reason: string;
  actor?: {
    name?: string | null;
    cpf?: string | null;
  } | null;
};

export class PainelAgendaError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PainelAgendaError";
    this.code = code;
    this.status = status;
  }
}

type AgendaMonthRow = {
  idagenda: number;
  dtagenda: Date | string;
  tpagenda: PainelAgendaType;
  stagenda: PainelAgendaStatus;
  idtabpreco: number | null;
  idinformacao: number | null;
  nmpromocional: string | null;
  dspromocional: string | null;
  nmtabpreco: string | null;
  vlnormal: string | null;
  vlinfant: string | null;
  informacao_nome: string | null;
  nudia: number;
  numes: number;
  nuano: number;
};

type AgendaVoucherRow = {
  idcompra: number;
  nmusuario: string | null;
  telefone: string | null;
  celular: string | null;
  email: string | null;
  numvoucher: string | null;
  tpvoucher: string | null;
  descricao: string | null;
  vlunicompra: string | null;
  dtuso: string | null;
  stusado: string | null;
};

type OptionRow = {
  id: number;
  label: string;
};

const painelAgendaTypeLabels: Record<PainelAgendaType, string> = {
  padra: "Data padrão",
  promo: "Data promocional",
  escol: "Data escolar",
  igrej: "Igreja",
  casam: "Casamento",
  melho: "Melhor idade",
  confr: "Confraternização",
  ongs: "ONG",
  grmix: "Grupo misto",
};

const painelAgendaStatusLabels: Record<PainelAgendaStatus, string> = {
  abe: "Aberta",
  fec: "Fechada",
  lot: "Esgotada",
};

const voucherTypeLabels: Record<string, string> = {
  norma: "Passaporte",
  infan: "Passaporte Infantil",
  isent: "Isento",
  corte: "Cortesia",
  espec: "Especial",
  escol: "Escola",
};

function asDateString(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function parseMonthYear(
  monthValue: string | number | null | undefined,
  yearValue: string | number | null | undefined,
  now = new Date(),
) {
  const fallback = {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
  const month = Number(monthValue);
  const year = Number(yearValue);

  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    return fallback;
  }

  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    return fallback;
  }

  return { month, year };
}

function assertIsoDate(value: string, fieldName: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PainelAgendaError(
      "agenda_invalid_date",
      `Informe ${fieldName} em formato valido.`,
      400,
    );
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new PainelAgendaError(
      "agenda_invalid_date",
      `Informe ${fieldName} em formato valido.`,
      400,
    );
  }

  return value;
}

function toMoney(value: string | null) {
  if (!value) {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric.toFixed(2) : null;
}

function mapMonthEntry(row: AgendaMonthRow): PainelAgendaMonthEntry {
  return {
    id: row.idagenda,
    date: asDateString(row.dtagenda),
    day: Number(row.nudia),
    month: Number(row.numes),
    year: Number(row.nuano),
    type: row.tpagenda,
    typeLabel: painelAgendaTypeLabels[row.tpagenda] ?? row.tpagenda,
    status: row.stagenda,
    statusLabel: painelAgendaStatusLabels[row.stagenda] ?? row.stagenda,
    priceTableId: row.idtabpreco,
    priceTableName: row.nmtabpreco,
    normalValue: toMoney(row.vlnormal),
    childValue: toMoney(row.vlinfant),
    informationId: row.idinformacao,
    informationName: row.informacao_nome,
    promotionName: row.nmpromocional,
    promotionDescription: row.dspromocional,
  };
}

function mapVoucherEntry(row: AgendaVoucherRow): PainelAgendaVoucherEntry {
  return {
    purchaseId: row.idcompra,
    customerName: row.nmusuario,
    phone: row.telefone,
    mobile: row.celular,
    email: row.email,
    voucherNumber: row.numvoucher,
    voucherType: row.tpvoucher,
    voucherTypeLabel:
      String(row.descricao ?? "").trim() ||
      voucherTypeLabels[String(row.tpvoucher ?? "").trim()] ||
      String(row.tpvoucher ?? ""),
    unitValue: toMoney(row.vlunicompra),
    useDate: row.dtuso ? row.dtuso.slice(0, 10) : null,
    used: String(row.stusado ?? "").trim() === "s",
  };
}

function listRangeDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  const current = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  while (current.getTime() <= end.getTime()) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export async function getPainelAgendaScreenData(input: {
  month?: string | number | null;
  year?: string | number | null;
  selectedDate?: string | null;
}) {
  const { month, year } = parseMonthYear(input.month, input.year);
  const selectedDate =
    typeof input.selectedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.selectedDate)
      ? input.selectedDate
      : null;
  const [entries, selectedDay, priceTables, informationOptions] =
    await Promise.all([
      listPainelAgendaMonth(month, year),
      selectedDate ? getPainelAgendaDay(selectedDate) : Promise.resolve(null),
      listPainelAgendaPriceTables(),
      listPainelAgendaInformationOptions(),
    ]);

  return {
    month,
    year,
    entries,
    selectedDate,
    selectedDay,
    priceTables,
    informationOptions,
  } satisfies PainelAgendaScreenData;
}

export async function listPainelAgendaMonth(month: number, year: number) {
  const pool = getIngressoDbPool();
  const result = await pool.query<AgendaMonthRow>(
    `
      SELECT
        agenda.idagenda,
        agenda.dtagenda,
        agenda.tpagenda,
        agenda.stagenda,
        agenda.idtabpreco,
        agenda.idinformacao,
        agenda.nmpromocional,
        agenda.dspromocional,
        EXTRACT(DAY FROM agenda.dtagenda)::int AS nudia,
        EXTRACT(MONTH FROM agenda.dtagenda)::int AS numes,
        EXTRACT(YEAR FROM agenda.dtagenda)::int AS nuano,
        tabpreco.nmtabpreco,
        tabpreco.vlnormal::text AS vlnormal,
        tabpreco.vlinfant::text AS vlinfant,
        informacao.nome AS informacao_nome
      FROM agenda
      LEFT JOIN tabpreco ON tabpreco.idtabpreco = agenda.idtabpreco
      LEFT JOIN informacao ON informacao.idinformacao = agenda.idinformacao
      WHERE EXTRACT(MONTH FROM agenda.dtagenda) = $1
        AND EXTRACT(YEAR FROM agenda.dtagenda) = $2
      ORDER BY agenda.dtagenda ASC, agenda.idagenda ASC
    `,
    [month, year],
  );

  return result.rows.map(mapMonthEntry);
}

export async function getPainelAgendaDay(date: string) {
  assertIsoDate(date, "a data selecionada");
  const pool = getIngressoDbPool();
  const [agendaResult, vouchersResult] = await Promise.all([
    pool.query<AgendaMonthRow>(
      `
        SELECT
          agenda.idagenda,
          agenda.dtagenda,
          agenda.tpagenda,
          agenda.stagenda,
          agenda.idtabpreco,
          agenda.idinformacao,
          agenda.nmpromocional,
          agenda.dspromocional,
          EXTRACT(DAY FROM agenda.dtagenda)::int AS nudia,
          EXTRACT(MONTH FROM agenda.dtagenda)::int AS numes,
          EXTRACT(YEAR FROM agenda.dtagenda)::int AS nuano,
          tabpreco.nmtabpreco,
          tabpreco.vlnormal::text AS vlnormal,
          tabpreco.vlinfant::text AS vlinfant,
          informacao.nome AS informacao_nome
        FROM agenda
        LEFT JOIN tabpreco ON tabpreco.idtabpreco = agenda.idtabpreco
        LEFT JOIN informacao ON informacao.idinformacao = agenda.idinformacao
        WHERE agenda.dtagenda = $1::date
        LIMIT 1
      `,
      [date],
    ),
    pool.query<AgendaVoucherRow>(
      `
        SELECT
          compra.idcompra,
          usuario.nmusuario,
          usuario.telefone,
          usuario.celular,
          usuario.email,
          voucher.numvoucher,
          voucher.tpvoucher,
          voucher.descricao,
          voucher.vlunicompra::text AS vlunicompra,
          to_char(voucher.dtuso, 'YYYY-MM-DD') AS dtuso,
          voucher.stusado
        FROM voucher
        JOIN compra ON compra.idcompra = voucher.idcompra
        LEFT JOIN usuario ON usuario.cpf = compra.cpf
        WHERE voucher.dtuso = $1::date
        ORDER BY voucher.idvoucher DESC
      `,
      [date],
    ),
  ]);

  const availability = await getAgendaProductAvailability(date);

  return {
    selectedDate: date,
    agenda: agendaResult.rows[0] ? mapMonthEntry(agendaResult.rows[0]) : null,
    vouchers: vouchersResult.rows.map(mapVoucherEntry),
    selectedPassportIds: availability.passportIds,
    selectedAddonIds: availability.addonIds,
  } satisfies PainelAgendaDayDetail;
}

export async function listPainelAgendaPriceTables() {
  const pool = getIngressoDbPool();
  const result = await pool.query<OptionRow>(
    `
      SELECT idtabpreco AS id, nmtabpreco AS label
      FROM tabpreco
      WHERE COALESCE(sttabpreco, 'ati') <> 'ina'
      ORDER BY nmtabpreco ASC
    `,
  );

  return result.rows.map((row) => ({ id: Number(row.id), label: row.label }));
}

export async function listPainelAgendaInformationOptions() {
  const pool = getIngressoDbPool();
  const result = await pool.query<OptionRow>(
    `
      SELECT idinformacao AS id, nome AS label
      FROM informacao
      WHERE COALESCE(status, 'ati') = 'ati'
      ORDER BY nome ASC
    `,
  );

  return result.rows.map((row) => ({ id: Number(row.id), label: row.label }));
}

function validateMutationInput(input: PainelAgendaMutationInput) {
  const startDate = assertIsoDate(input.startDate, "a data inicial");
  const endDate = assertIsoDate(input.endDate, "a data final");

  if (endDate < startDate) {
    throw new PainelAgendaError(
      "agenda_invalid_range",
      "A data final deve ser igual ou posterior a data inicial.",
      400,
    );
  }

  if (!Number.isInteger(input.priceTableId) || input.priceTableId <= 0) {
    throw new PainelAgendaError(
      "agenda_invalid_price_table",
      "Selecione uma tabela de preço válida.",
      400,
    );
  }

  if (!Number.isInteger(input.informationId) || input.informationId <= 0) {
    throw new PainelAgendaError(
      "agenda_invalid_information",
      "Selecione uma informação válida.",
      400,
    );
  }

  if (!painelAgendaTypeLabels[input.type]) {
    throw new PainelAgendaError(
      "agenda_invalid_type",
      "Selecione um tipo de agenda valido.",
      400,
    );
  }

  if (!painelAgendaStatusLabels[input.status]) {
    throw new PainelAgendaError(
      "agenda_invalid_status",
      "Selecione um status de agenda valido.",
      400,
    );
  }

  if (String(input.reason ?? "").trim().length === 0) {
    throw new PainelAgendaError(
      "agenda_reason_required",
      "Informe o motivo da alteração.",
      400,
    );
  }

  if (input.type === "promo") {
    if (String(input.promotionName ?? "").trim().length === 0) {
      throw new PainelAgendaError(
        "agenda_promotion_name_required",
        "Informe o nome promocional.",
        400,
      );
    }

    if (String(input.promotionDescription ?? "").trim().length === 0) {
      throw new PainelAgendaError(
        "agenda_promotion_description_required",
        "Informe a descrição promocional.",
        400,
      );
    }
  }

  return {
    ...input,
    startDate,
    endDate,
    promotionName:
      input.type === "promo" ? String(input.promotionName ?? "").trim() : null,
    promotionDescription:
      input.type === "promo"
        ? String(input.promotionDescription ?? "").trim()
        : null,
    reason: String(input.reason).trim(),
    actor: {
      name: input.actor?.name?.trim() || null,
      cpf: input.actor?.cpf?.trim() || null,
    },
    passportIds: Array.isArray(input.passportIds) ? input.passportIds : [],
    addonIds: Array.isArray(input.addonIds) ? input.addonIds : [],
  };
}

export async function previewPainelAgendaRange(input: {
  startDate: string;
  endDate: string;
  excludeAgendaId?: number | null;
}) {
  const startDate = assertIsoDate(input.startDate, "a data inicial");
  const endDate = assertIsoDate(input.endDate, "a data final");
  const excludeAgendaId =
    Number.isInteger(input.excludeAgendaId) && Number(input.excludeAgendaId) > 0
      ? Number(input.excludeAgendaId)
      : null;

  if (endDate < startDate) {
    throw new PainelAgendaError(
      "agenda_invalid_range",
      "A data final deve ser igual ou posterior a data inicial.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const result = await pool.query<{
    dtagenda: string;
    tpagenda: PainelAgendaType;
  }>(
    `
      SELECT to_char(dtagenda, 'YYYY-MM-DD') AS dtagenda, tpagenda
      FROM agenda
      WHERE dtagenda BETWEEN $1::date AND $2::date
        AND ($3::int IS NULL OR idagenda <> $3::int)
      ORDER BY dtagenda ASC
    `,
    [startDate, endDate, excludeAgendaId],
  );

  return {
    existingDates: result.rows.map((row) => row.dtagenda),
    hasSchoolDates: result.rows.some((row) => row.tpagenda === "escol"),
  } satisfies PainelAgendaRangePreview;
}

export async function upsertPainelAgendaRange(input: PainelAgendaMutationInput) {
  const normalized = validateMutationInput(input);
  const preview = await previewPainelAgendaRange({
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    excludeAgendaId:
      Number.isInteger(normalized.agendaId) && Number(normalized.agendaId) > 0
        ? Number(normalized.agendaId)
        : null,
  });

  if (preview.hasSchoolDates && normalized.type !== "escol") {
    throw new PainelAgendaError(
      "agenda_school_conflict",
      "Não é possível alterar a faixa informada porque existem agendas escolares nas datas selecionadas.",
      409,
    );
  }

  if (preview.existingDates.length > 0 && !normalized.confirmOverwrite) {
    throw new PainelAgendaError(
      "agenda_confirmation_required",
      `Existem datas já cadastradas na faixa selecionada: ${preview.existingDates
        .map(formatPainelAgendaDateLabel)
        .join(", ")}.`,
      409,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query<{
      idagenda: number;
      dtagenda: string;
    }>(
      `
        SELECT idagenda, to_char(dtagenda, 'YYYY-MM-DD') AS dtagenda
        FROM agenda
        WHERE dtagenda BETWEEN $1::date AND $2::date
      `,
      [normalized.startDate, normalized.endDate],
    );
    const existingByDate = new Map(
      existingResult.rows.map((row) => [row.dtagenda, row]),
    );
    const dates = listRangeDates(normalized.startDate, normalized.endDate);

    for (const date of dates) {
      const existing = existingByDate.get(date);

      if (existing) {
        await client.query(
          `
            UPDATE agenda
            SET
              idtabpreco = $1,
              idinformacao = $2,
              tpagenda = $3,
              stagenda = $4,
              nmpromocional = $5,
              dspromocional = $6,
              dtualt = CURRENT_DATE,
              hrualt = CURRENT_TIME
            WHERE idagenda = $7
          `,
          [
            normalized.priceTableId,
            normalized.informationId,
            normalized.type,
            normalized.status,
            normalized.promotionName,
            normalized.promotionDescription,
            existing.idagenda,
          ],
        );
      } else {
        await client.query(
          `
            INSERT INTO agenda (
              dtagenda,
              idtabpreco,
              idinformacao,
              tpagenda,
              stagenda,
              nmpromocional,
              dspromocional,
              dtcadastro,
              hrcadastro
            ) VALUES (
              $1::date,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              CURRENT_DATE,
              CURRENT_TIME
            )
          `,
          [
            date,
            normalized.priceTableId,
            normalized.informationId,
            normalized.type,
            normalized.status,
            normalized.promotionName,
            normalized.promotionDescription,
          ],
        );
      }
    }

    await registerOpsAuditLog(client, {
      origem: "painel-agenda",
      acao: "upsert_range",
      descricao: `Agenda atualizada de ${formatPainelAgendaDateLabel(
        normalized.startDate,
      )} ate ${formatPainelAgendaDateLabel(normalized.endDate)}.`,
      motivo: normalized.reason,
      usuarioNome:
        normalized.actor.name || normalized.actor.cpf || "Painel agenda",
      detalhes: {
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        priceTableId: normalized.priceTableId,
        informationId: normalized.informationId,
        type: normalized.type,
        status: normalized.status,
        passportIds: normalized.passportIds,
        addonIds: normalized.addonIds,
        overwrittenDates: preview.existingDates,
      },
    });

    await client.query("COMMIT");
    await setAgendaProductAvailabilityRange(dates, {
      passportIds: normalized.passportIds,
      addonIds: normalized.addonIds,
    });

    return {
      ok: true,
      message:
        dates.length === 1
          ? "Agenda do dia salva com sucesso."
          : "Agenda da faixa salva com sucesso.",
      touchedDates: dates,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof PainelAgendaError) {
      throw error;
    }
    throw new PainelAgendaError(
      "agenda_upsert_failed",
      "Não foi possível salvar a agenda agora.",
      500,
    );
  } finally {
    client.release();
  }
}

export async function deletePainelAgenda(
  agendaId: number,
  input: {
    reason: string;
    actor?: {
      name?: string | null;
      cpf?: string | null;
    } | null;
  },
) {
  if (!Number.isInteger(agendaId) || agendaId <= 0) {
    throw new PainelAgendaError(
      "agenda_invalid_id",
      "Informe uma agenda válida para exclusão.",
      400,
    );
  }

  if (String(input.reason ?? "").trim().length === 0) {
    throw new PainelAgendaError(
      "agenda_reason_required",
      "Informe o motivo da exclusão.",
      400,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const agendaResult = await client.query<{
      idagenda: number;
      dtagenda: string;
      tpagenda: PainelAgendaType;
    }>(
      `
        SELECT
          idagenda,
          to_char(dtagenda, 'YYYY-MM-DD') AS dtagenda,
          tpagenda
        FROM agenda
        WHERE idagenda = $1
        LIMIT 1
      `,
      [agendaId],
    );
    const agenda = agendaResult.rows[0];

    if (!agenda) {
      throw new PainelAgendaError(
        "agenda_not_found",
        "Agenda nao encontrada.",
        404,
      );
    }

    await client.query("DELETE FROM agenda_faixas WHERE idagenda = $1", [agendaId]);

    if (agenda.tpagenda === "escol") {
      await client.query("DELETE FROM agenda_extras WHERE idagenda = $1", [agendaId]);
    }

    await client.query("DELETE FROM agenda WHERE idagenda = $1", [agendaId]);

    await registerOpsAuditLog(client, {
      origem: "painel-agenda",
      acao: "delete",
      descricao: `Agenda do dia ${formatPainelAgendaDateLabel(agenda.dtagenda)} removida.`,
      motivo: String(input.reason).trim(),
      usuarioNome:
        input.actor?.name?.trim() || input.actor?.cpf?.trim() || "Painel agenda",
      detalhes: {
        agendaId,
        date: agenda.dtagenda,
        type: agenda.tpagenda,
      },
    });

    await client.query("COMMIT");
    removeAgendaProductAvailability(agenda.dtagenda);

    return {
      ok: true,
      deletedId: agendaId,
      deletedDate: agenda.dtagenda,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof PainelAgendaError) {
      throw error;
    }

    throw new PainelAgendaError(
      "agenda_delete_failed",
      "Não foi possível remover a agenda. Verifique se existem relacionamentos ativos.",
      409,
    );
  } finally {
    client.release();
  }
}

export function asPainelAgendaError(error: unknown) {
  if (error instanceof PainelAgendaError) {
    return error;
  }

  return new PainelAgendaError(
    "agenda_unknown_error",
    "Não foi possível concluir a operação da agenda.",
    500,
  );
}
