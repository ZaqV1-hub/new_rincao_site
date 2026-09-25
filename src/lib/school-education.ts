export type SchoolEducationYear = {
  id: string;
  label: string;
};

export type SchoolEducationType = {
  id: string;
  label: string;
  order: number;
  years: SchoolEducationYear[];
};

export type SchoolEducationStructure = {
  types: SchoolEducationType[];
  classes: string[];
};

export const schoolTypeOptions = [
  { id: "cei", label: "CEI" },
  { id: "emei", label: "EMEI" },
  { id: "cemei", label: "CEMEI" },
  { id: "emef", label: "EMEF" },
  { id: "ee", label: "E.E. (Escola Estadual)" },
  { id: "particular", label: "Escola Particular" },
] as const;

// Diretorias que atendem as escolas estaduais da capital paulista. A lista segue
// a nomenclatura usada pela Secretaria da Educação do Estado de São Paulo.
export const schoolEducationBoardOptions = [
  "Centro",
  "Centro Oeste",
  "Centro Sul",
  "Leste 1",
  "Leste 2",
  "Leste 3",
  "Leste 4",
  "Leste 5",
  "Norte 1",
  "Norte 2",
  "Sul 1",
  "Sul 2",
  "Sul 3",
] as const;

export type SchoolType = (typeof schoolTypeOptions)[number]["id"];

const rawEducationTypes = [
  {
    id: "infantil",
    label: "Educacao Infantil",
    order: 1,
    years: [
      { id: "bercario1", label: "Berçário I" },
      { id: "bercario2", label: "Berçário II" },
      { id: "minigrupo1", label: "Mini-Grupo I" },
      { id: "minigrupo2", label: "Mini-Grupo II" },
      { id: "infantil1", label: "Infantil I" },
      { id: "infantil2", label: "Infantil II" },
    ],
  },
  {
    id: "fund1",
    label: "Ensino Fundamental I",
    order: 2,
    years: [
      { id: "1", label: "1o ano" },
      { id: "2", label: "2o ano" },
      { id: "3", label: "3o ano" },
      { id: "4", label: "4o ano" },
      { id: "5", label: "5o ano" },
    ],
  },
  {
    id: "fund2",
    label: "Ensino Fundamental II",
    order: 3,
    years: [
      { id: "6", label: "6o ano" },
      { id: "7", label: "7o ano" },
      { id: "8", label: "8o ano" },
      { id: "9", label: "9o ano" },
    ],
  },
  {
    id: "medio",
    label: "Ensino Medio",
    order: 4,
    years: [
      { id: "1", label: "1o ano" },
      { id: "2", label: "2o ano" },
      { id: "3", label: "3o ano" },
    ],
  },
];

const classLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
const miltonSantosSchoolId = 571;
const miltonSantosClassLetters = [
  ...classLetters,
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
];

const schoolTypeEducationRules: Record<Exclude<SchoolType, "particular">, Record<string, string[]>> = {
  cei: { infantil: ["bercario1", "bercario2", "minigrupo1", "minigrupo2"] },
  emei: { infantil: ["infantil1", "infantil2"] },
  cemei: {
    infantil: [
      "bercario1",
      "bercario2",
      "minigrupo1",
      "minigrupo2",
      "infantil1",
      "infantil2",
    ],
  },
  emef: { fund1: ["1", "2", "3", "4", "5"], fund2: ["6", "7", "8", "9"] },
  ee: {
    fund1: ["1", "2", "3", "4", "5"],
    fund2: ["6", "7", "8", "9"],
    medio: ["1", "2", "3"],
  },
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function normalizeSchoolType(raw: unknown): SchoolType | null {
  const normalized = slugify(String(raw ?? ""));
  return schoolTypeOptions.find((option) => option.id === normalized)?.id ?? null;
}

export function inferSchoolTypeFromName(raw: string): SchoolType | null {
  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  if (/\bCEMEI\b/u.test(normalized)) return "cemei";
  if (/\bEMEF\b/u.test(normalized)) return "emef";
  if (/\bEMEI\b/u.test(normalized)) return "emei";
  if (/\bCEI\b/u.test(normalized)) return "cei";
  if (/\bE\s*\.?\s*E\.?\b/u.test(normalized)) return "ee";
  return null;
}

export function getSchoolEducationStructure(
  schoolTypeRaw?: SchoolType | string | null,
  schoolId?: number,
): SchoolEducationStructure {
  const schoolType = normalizeSchoolType(schoolTypeRaw);
  // TODO: definir a estrutura específica das escolas particulares em uma rodada futura.
  const rule = schoolType && schoolType !== "particular" ? schoolTypeEducationRules[schoolType] : null;

  return {
    types: rawEducationTypes
      .filter((type) => !rule || type.id in rule)
      .map((type) => ({
        ...type,
        years: type.years
          .filter((year) => !rule || rule[type.id]?.includes(year.id))
          .map((year) => ({ ...year })),
      })),
    classes: [
      ...(schoolId === miltonSantosSchoolId
        ? miltonSantosClassLetters
        : classLetters),
    ],
  };
}

export function isSchoolEducationSelectionAllowed(
  schoolTypeRaw: SchoolType | string | null | undefined,
  educationTypeRaw: string,
  educationYearRaw: string,
) {
  const educationType = normalizeSchoolEducationType(educationTypeRaw);
  const educationYear = normalizeSchoolEducationYear(educationTypeRaw, educationYearRaw);
  const structure = getSchoolEducationStructure(schoolTypeRaw);

  return Boolean(
    educationType &&
      educationYear &&
      structure.types.some(
        (type) =>
          type.id === educationType && type.years.some((year) => year.id === educationYear),
      ),
  );
}

export function normalizeSchoolEducationType(raw: string) {
  const normalized = slugify(raw);

  if (!normalized) {
    return null;
  }

  if (normalized.includes("fundamental") && normalized.includes("2")) {
    return "fund2";
  }

  if (normalized.includes("fundamental") && normalized.includes("ii")) {
    return "fund2";
  }

  if (normalized.includes("fundamental")) {
    return "fund1";
  }

  if (
    ["educacaoinfantil", "educacaoinf", "infantil"].includes(normalized) ||
    normalized.includes("infantil")
  ) {
    return "infantil";
  }

  if (normalized.includes("medio")) {
    return "medio";
  }

  return rawEducationTypes.find((type) => slugify(type.id) === normalized)?.id ?? null;
}

export function normalizeSchoolEducationYear(
  educationTypeRaw: string,
  educationYearRaw: string,
) {
  const educationType = normalizeSchoolEducationType(educationTypeRaw);
  const yearValue = educationYearRaw.trim();

  if (!educationType || !yearValue) {
    return null;
  }

  const structure = getSchoolEducationStructure();
  const type = structure.types.find((entry) => entry.id === educationType);

  if (!type) {
    return null;
  }

  const directMatch = type.years.find(
    (entry) => entry.id === yearValue || slugify(entry.label) === slugify(yearValue),
  );

  if (directMatch) {
    return directMatch.id;
  }

  const numericMatch = yearValue.match(/[1-9]/)?.[0] ?? null;

  if (!numericMatch) {
    return null;
  }

  return type.years.find((entry) => entry.id === numericMatch)?.id ?? null;
}

export function normalizeSchoolClassLetter(raw: string) {
  const normalized = raw.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  const exact = classLetters.find((entry) => entry === normalized);

  if (exact) {
    return exact;
  }

  const token = normalized.match(/\b([A-V])\b/u);
  return token?.[1] ?? null;
}

export function isSchoolClassLetterAllowed(schoolId: number, classLetter: string) {
  return getSchoolEducationStructure(null, schoolId).classes.includes(classLetter);
}

export function buildSchoolClassDisplay(
  educationTypeRaw: string,
  educationYearRaw: string,
  classLetterRaw: string,
) {
  const structure = getSchoolEducationStructure();
  const educationType = normalizeSchoolEducationType(educationTypeRaw);
  const educationYear = normalizeSchoolEducationYear(
    educationTypeRaw,
    educationYearRaw,
  );
  const classLetter = normalizeSchoolClassLetter(classLetterRaw);

  if (!educationType || !educationYear || !classLetter) {
    return "";
  }

  const type = structure.types.find((entry) => entry.id === educationType);
  const year = type?.years.find((entry) => entry.id === educationYear);

  if (!type || !year) {
    return "";
  }

  return `${type.label} - ${year.label} - ${classLetter}`;
}
