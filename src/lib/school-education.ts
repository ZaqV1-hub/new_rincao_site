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

const rawEducationTypes = [
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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function getSchoolEducationStructure(): SchoolEducationStructure {
  return {
    types: rawEducationTypes.map((type) => ({
      ...type,
      years: type.years.map((year) => ({ ...year })),
    })),
    classes: [...classLetters],
  };
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

  const token = normalized.match(/\b([A-K])\b/u);
  return token?.[1] ?? null;
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
