import { formatDateLabel, parseSchoolValueInput, normalizeMoney } from "@/lib/school-purchase-values";
import { encodeLegacyId } from "@/lib/agenda-id";
import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import {
  getSchoolEducationStructure,
  isSchoolClassLetterAllowed,
  isSchoolEducationSelectionAllowed,
  normalizeSchoolClassLetter,
  normalizeSchoolEducationType,
  normalizeSchoolEducationYear,
  type SchoolEducationStructure,
} from "@/lib/school-education";
import { ensureSchoolTypeColumn, normalizeStoredSchoolType } from "@/lib/school-profile";

type SchoolRow = {
  id: number;
  name: string;
  address: string | null;
};

type SchoolTripRow = {
  idagenda: number;
  dtagenda: string;
  school_name: string;
  school_type: string | null;
};

type PurchaseInsertRow = {
  idcompra: number;
};

export type SchoolOption = {
  id: number;
  name: string;
  address: string;
};

export type SchoolTripDate = {
  agendaId: number;
  date: string;
  label: string;
};

export type SchoolPurchaseContext = {
  schoolId: number;
  schoolName: string;
  schoolType: string | null;
  dates: SchoolTripDate[];
  educationStructure: SchoolEducationStructure;
};

export type SchoolPurchasePreset = {
  schoolId: number;
  schoolName: string;
  agendaId: number;
  agendaLabel: string;
};

export { SchoolPurchaseError } from "@/lib/school-purchase-input";
export type { CreateSchoolPurchaseInput } from "@/lib/school-purchase-input";
import { SchoolPurchaseError, type CreateSchoolPurchaseInput } from "@/lib/school-purchase-input";
import { admitSiteSchoolPurchase, bindSiteSchoolPurchase } from "@/lib/school-commerce-admission";
import { insertSchoolPurchaseVoucher } from "@/lib/school-purchase-voucher";

export async function searchSchoolsByName(term: string) {
  const normalized = term.trim();

  if (normalized.length < 2) {
    return [] satisfies SchoolOption[];
  }

  const pool = getIngressoSistemaDbPool();
  const result = await pool.query<SchoolRow>(
    `
      SELECT DISTINCT
        c.idcliente AS id,
        c.nome AS name,
        NULLIF(btrim(c.endereco), '') AS address
      FROM clientes c
      JOIN agenda_extras ae ON ae.idcliente = c.idcliente
      JOIN agenda a ON a.idagenda = ae.idagenda
      WHERE c.idtipo = 4
        AND c.status = true
        AND ae.stagenda_cli = 'abe'
        AND a.dtagenda >= CURRENT_DATE
        AND to_ascii(lower(c.nome), 'LATIN1') LIKE to_ascii(lower($1), 'LATIN1')
      ORDER BY c.nome ASC
      LIMIT 20
    `,
    [`%${normalized}%`],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    address: row.address ?? "",
  }));
}

export async function getSchoolPurchaseContext(
  schoolId: number,
): Promise<SchoolPurchaseContext | null> {
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await ensureSchoolTypeColumn(client);
    const result = await client.query<SchoolTripRow>(
    `
      SELECT
        a.idagenda,
        a.dtagenda::text,
        c.nome AS school_name,
        c.tipo_escola AS school_type
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

    const schoolType = normalizeStoredSchoolType(result.rows[0].school_type);

    return {
      schoolId,
      schoolName: result.rows[0].school_name,
      schoolType,
      dates: result.rows.map((row) => ({
        agendaId: row.idagenda,
        date: row.dtagenda,
        label: formatDateLabel(row.dtagenda),
      })),
      educationStructure: getSchoolEducationStructure(schoolType, schoolId),
    };
  } finally {
    client.release();
  }
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
  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();

  try {
    await ensureSchoolTypeColumn(client);
    const result = await client.query<SchoolTripRow>(
    `
      SELECT
        a.idagenda,
        a.dtagenda::text,
        c.nome AS school_name,
        c.tipo_escola AS school_type
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
  } finally {
    client.release();
  }
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

    if (!isSchoolClassLetterAllowed(input.schoolId, classLetter)) {
      throw new SchoolPurchaseError(
        "invalid_class_letter",
        "Selecione uma turma valida para esta escola.",
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

  if (
    input.participantType !== "educator" &&
    !isSchoolEducationSelectionAllowed(
      normalizeStoredSchoolType(availableTrip.school_type),
      input.educationType,
      input.educationYear,
    )
  ) {
    throw new SchoolPurchaseError(
      "school_education_not_allowed",
      "A série informada não está disponível para o tipo desta escola.",
      400,
    );
  }

  const pool = getIngressoSistemaDbPool();
  const client = await pool.connect();
  const totalValue = normalizeMoney(parsedValue);

  try {
    await client.query("BEGIN");
    const schoolAdmission = input.participantType === "educator" ? null : await admitSiteSchoolPurchase(client, cpf,
      { schoolId: input.schoolId, agendaId: input.agendaId, schoolName: availableTrip.school_name,
        visitDate: availableTrip.dtagenda, studentName, educationType: educationType!, educationYear: educationYear!,
        classLetter: classLetter!, amount: parsedValue });

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
          flenvio,
          origem_checkout
        )
        VALUES (
          $1,
          'ponli',
          CURRENT_DATE,
          CURRENT_TIME,
          'pgseg',
          $2,
          'pend',
          'nao',
          'site'
        )
        RETURNING idcompra
      `,
      [cpf, totalValue],
    );
    const purchaseId = purchaseResult.rows[0]?.idcompra;

    if (!purchaseId) {
      throw new Error("school_purchase_insert_failed");
    }

    await bindSiteSchoolPurchase(client, purchaseId, schoolAdmission);
    await insertSchoolPurchaseVoucher(client, input, purchaseId, totalValue, availableTrip.dtagenda,
      { studentName, educationType, educationYear, classLetter, educatorName, educatorRole,
        classDisplay: schoolAdmission?.quote.school_purchase.class_display });

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
