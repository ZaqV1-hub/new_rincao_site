import { encodeLegacyId } from "@/lib/agenda-id";
import { getIngressoDbPool } from "@/lib/ingresso-db";
import {
  buildSchoolClassDisplay,
  getSchoolEducationStructure,
  normalizeSchoolClassLetter,
  normalizeSchoolEducationType,
  normalizeSchoolEducationYear,
  type SchoolEducationStructure,
} from "@/lib/school-education";
import { generateUniqueVoucherNumber } from "@/lib/voucher-number";

type SchoolRow = {
  id: number;
  name: string;
};

type SchoolTripRow = {
  idagenda: number;
  dtagenda: string;
  school_name: string;
};

type PurchaseInsertRow = {
  idcompra: number;
};

export type SchoolOption = {
  id: number;
  name: string;
};

export type SchoolTripDate = {
  agendaId: number;
  date: string;
  label: string;
};

export type SchoolPurchaseContext = {
  schoolId: number;
  schoolName: string;
  dates: SchoolTripDate[];
  educationStructure: SchoolEducationStructure;
};

export type SchoolPurchasePreset = {
  schoolId: number;
  schoolName: string;
  agendaId: number;
  agendaLabel: string;
};

export type CreateStudentPurchaseInput = {
  participantType?: "student";
  schoolId: number;
  studentName: string;
  educationType: string;
  educationYear: string;
  classLetter: string;
  agendaId: number;
  value: string;
};

export type CreateEducatorPurchaseInput = {
  participantType: "educator";
  schoolId: number;
  educatorName: string;
  educatorRole: string;
  agendaId: number;
  value: string;
};

export type CreateSchoolPurchaseInput =
  | CreateStudentPurchaseInput
  | CreateEducatorPurchaseInput;

export class SchoolPurchaseError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "SchoolPurchaseError";
    this.code = code;
    this.status = status;
  }
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function parseSchoolValueInput(raw: string) {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const numeric = Number(normalized);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

function normalizeMoney(value: number) {
  return value.toFixed(2);
}

export async function searchSchoolsByName(term: string) {
  const normalized = term.trim();

  if (normalized.length < 2) {
    return [] satisfies SchoolOption[];
  }

  const pool = getIngressoDbPool();
  const result = await pool.query<SchoolRow>(
    `
      SELECT idcliente AS id, nome AS name
      FROM clientes
      WHERE idtipo = 4
        AND status = true
        AND to_ascii(lower(nome), 'LATIN1') LIKE to_ascii(lower($1), 'LATIN1')
      ORDER BY nome ASC
      LIMIT 20
    `,
    [`%${normalized}%`],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
  }));
}

export async function getSchoolPurchaseContext(
  schoolId: number,
): Promise<SchoolPurchaseContext | null> {
  const pool = getIngressoDbPool();
  const result = await pool.query<SchoolTripRow>(
    `
      SELECT
        a.idagenda,
        a.dtagenda::text,
        c.nome AS school_name
      FROM agenda a
      JOIN agenda_extras ae ON ae.idagenda = a.idagenda
      JOIN clientes c ON c.idcliente = ae.idcliente
      WHERE ae.idcliente = $1
        AND c.idtipo = 4
        AND c.status = true
        AND ae.stagenda_cli = 'abe'
        AND a.dtagenda >= CURRENT_DATE
      ORDER BY a.dtagenda ASC
    `,
    [schoolId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return {
    schoolId,
    schoolName: result.rows[0].school_name,
    dates: result.rows.map((row) => ({
      agendaId: row.idagenda,
      date: row.dtagenda,
      label: formatDateLabel(row.dtagenda),
    })),
    educationStructure: getSchoolEducationStructure(),
  };
}

export async function resolveSchoolPurchasePreset(
  schoolId: number,
  agendaId: number,
): Promise<SchoolPurchasePreset | null> {
  const context = await getSchoolPurchaseContext(schoolId);

  if (!context) {
    return null;
  }

  const date = context.dates.find((item) => item.agendaId === agendaId);

  if (!date) {
    return null;
  }

  return {
    schoolId: context.schoolId,
    schoolName: context.schoolName,
    agendaId: date.agendaId,
    agendaLabel: date.label,
  };
}

async function assertSchoolTripAvailability(schoolId: number, agendaId: number) {
  const pool = getIngressoDbPool();
  const result = await pool.query<SchoolTripRow>(
    `
      SELECT
        a.idagenda,
        a.dtagenda::text,
        c.nome AS school_name
      FROM agenda a
      JOIN agenda_extras ae ON ae.idagenda = a.idagenda
      JOIN clientes c ON c.idcliente = ae.idcliente
      WHERE ae.idcliente = $1
        AND a.idagenda = $2
        AND c.idtipo = 4
        AND c.status = true
        AND ae.stagenda_cli = 'abe'
        AND a.dtagenda >= CURRENT_DATE
      LIMIT 1
    `,
    [schoolId, agendaId],
  );

  return result.rows[0] ?? null;
}

export async function createSchoolPurchase(
  cpf: string,
  input: CreateSchoolPurchaseInput,
) {
  const parsedValue = parseSchoolValueInput(input.value);

  let studentName = "";
  let educationType: string | null = null;
  let educationYear: string | null = null;
  let classLetter: string | null = null;
  let educatorName = "";
  let educatorRole = "";

  if (input.participantType === "educator") {
    educatorName = input.educatorName.trim();
    educatorRole = input.educatorRole.trim();

    if (!educatorName) {
      throw new SchoolPurchaseError(
        "invalid_educator_name",
        "Informe o nome completo do educador.",
        400,
      );
    }

    if (!educatorRole) {
      throw new SchoolPurchaseError(
        "invalid_educator_role",
        "Selecione a funcao do educador.",
        400,
      );
    }
  } else {
    studentName = input.studentName.trim();
    educationType = normalizeSchoolEducationType(input.educationType);
    educationYear = normalizeSchoolEducationYear(
      input.educationType,
      input.educationYear,
    );
    classLetter = normalizeSchoolClassLetter(input.classLetter);

    if (!studentName) {
      throw new SchoolPurchaseError(
        "invalid_student_name",
        "Informe o nome completo do aluno.",
        400,
      );
    }

    if (!educationType) {
      throw new SchoolPurchaseError(
        "invalid_education_type",
        "Selecione um tipo de ensino valido.",
        400,
      );
    }

    if (!educationYear) {
      throw new SchoolPurchaseError(
        "invalid_education_year",
        "Selecione um ano valido para o tipo informado.",
        400,
      );
    }

    if (!classLetter) {
      throw new SchoolPurchaseError(
        "invalid_class_letter",
        "Selecione uma turma valida.",
        400,
      );
    }
  }

  if (!parsedValue) {
    throw new SchoolPurchaseError(
      "invalid_value",
      "Informe o valor exato do passeio.",
      400,
    );
  }

  const availableTrip = await assertSchoolTripAvailability(
    input.schoolId,
    input.agendaId,
  );

  if (!availableTrip) {
    throw new SchoolPurchaseError(
      "school_trip_unavailable",
      "A data selecionada nao esta disponivel para esta escola.",
      409,
    );
  }

  const pool = getIngressoDbPool();
  const client = await pool.connect();
  const totalValue = normalizeMoney(parsedValue);

  try {
    await client.query("BEGIN");

    const purchaseResult = await client.query<PurchaseInsertRow>(
      `
        INSERT INTO compra (
          cpf,
          tpcompra,
          dtcompra,
          hrcompra,
          formapag,
          vltotcompra,
          stcompra,
          flenvio
        )
        VALUES (
          $1,
          'ponli',
          CURRENT_DATE,
          CURRENT_TIME,
          'pgseg',
          $2,
          'pend',
          'nao'
        )
        RETURNING idcompra
      `,
      [cpf, totalValue],
    );
    const purchaseId = purchaseResult.rows[0]?.idcompra;

    if (!purchaseId) {
      throw new Error("school_purchase_insert_failed");
    }

    const voucherNumber = await generateUniqueVoucherNumber(client, "ESC-");

    if (input.participantType === "educator") {
      await client.query(
        `
          INSERT INTO voucher (
            idcompra,
            numvoucher,
            idagenda,
            tpvoucher,
            vlunicompra,
            stusado,
            fldesconto,
            idescola,
            tpparticipante,
            nomeeducador,
            funcaoeducador,
            dtvalidade
          )
          VALUES (
            $1,
            $2,
            $3,
            'escol',
            $4,
            'n',
            'n',
            $5,
            $6,
            $7,
            $8,
            $9::date
          )
        `,
        [
          purchaseId,
          voucherNumber,
          input.agendaId,
          totalValue,
          input.schoolId,
          "educador",
          educatorName,
          educatorRole,
          availableTrip.dtagenda,
        ],
      );
    } else {
      await client.query(
        `
          INSERT INTO voucher (
            idcompra,
            numvoucher,
            idagenda,
            tpvoucher,
            vlunicompra,
            stusado,
            fldesconto,
            idescola,
            tpparticipante,
            nomealuno,
            ensino_tipo,
            ensino_ano,
            turma_letra,
            turma,
            periodo,
            dtvalidade
          )
          VALUES (
            $1,
            $2,
            $3,
            'escol',
            $4,
            'n',
            'n',
            $5,
            'aluno',
            $6,
            $7,
            $8,
            $9,
            $10,
            '',
            $11::date
          )
        `,
        [
          purchaseId,
          voucherNumber,
          input.agendaId,
          totalValue,
          input.schoolId,
          studentName,
          educationType!,
          educationYear!,
          classLetter!,
          buildSchoolClassDisplay(educationType!, educationYear!, classLetter!),
          availableTrip.dtagenda,
        ],
      );
    }

    await client.query("COMMIT");

    return {
      purchaseId,
      legacyEncodedId: encodeLegacyId(purchaseId),
      totalValue,
      voucherCount: 1,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
