const schoolTypes = {
  infantil: {
    label: "Educacao Infantil",
    years: {
      maternal: "Maternal",
      pre1: "Pre I",
      pre2: "Pre II",
    },
  },
  fund1: {
    label: "Ensino Fundamental I",
    years: {
      "1": "1o ano",
      "2": "2o ano",
      "3": "3o ano",
      "4": "4o ano",
      "5": "5o ano",
    },
  },
  fund2: {
    label: "Ensino Fundamental II",
    years: {
      "6": "6o ano",
      "7": "7o ano",
      "8": "8o ano",
      "9": "9o ano",
    },
  },
  medio: {
    label: "Ensino Medio",
    years: {
      "1": "1o ano",
      "2": "2o ano",
      "3": "3o ano",
    },
  },
} as const;

type SchoolTypeKey = keyof typeof schoolTypes;

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

function normalizeType(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = slug(value);

  if (normalized in schoolTypes) {
    return normalized as SchoolTypeKey;
  }

  if (
    ["educacaoinfantil", "edinfantil", "educacaoinf", "infantil"].includes(
      normalized,
    )
  ) {
    return "infantil";
  }

  if (
    [
      "ensinofundamental1",
      "fundamental1",
      "fundamentali",
      "fundamentalum",
      "fund1",
      "ef1",
      "fundamentalprimeiro",
    ].includes(normalized)
  ) {
    return "fund1";
  }

  if (
    [
      "ensinofundamental2",
      "fundamental2",
      "fundamentalii",
      "fundamentaldois",
      "fund2",
      "ef2",
      "fundamentalsegundo",
    ].includes(normalized)
  ) {
    return "fund2";
  }

  if (["ensinomedio", "medio", "em", "ensinom"].includes(normalized)) {
    return "medio";
  }

  if (normalized.includes("infantil")) {
    return "infantil";
  }

  if (normalized.includes("fundamental") && normalized.includes("2")) {
    return "fund2";
  }

  if (normalized.includes("fundamental") && normalized.includes("1")) {
    return "fund1";
  }

  if (normalized.includes("fundamental") && normalized.includes("ii")) {
    return "fund2";
  }

  if (normalized.includes("fundamental") && normalized.includes("i")) {
    return "fund1";
  }

  if (normalized.includes("medio")) {
    return "medio";
  }

  return null;
}

function normalizeYear(typeValue: string | null, value: string | null) {
  const type = normalizeType(typeValue);

  if (!type || !value) {
    return null;
  }

  const normalized = slug(value);

  if (type === "infantil") {
    if (normalized.includes("maternal")) {
      return "maternal";
    }

    if (normalized.includes("pre")) {
      return normalized.includes("ii") || normalized.includes("2")
        ? "pre2"
        : "pre1";
    }
  }

  const numericYear = normalized.match(/([1-9])/)?.[1];

  if (numericYear && numericYear in schoolTypes[type].years) {
    return numericYear as keyof (typeof schoolTypes)[typeof type]["years"];
  }

  return (
    Object.entries(schoolTypes[type].years).find(
      ([, label]) => slug(label) === normalized,
    )?.[0] ?? null
  );
}

function normalizeClass(value: string | null) {
  if (!value) {
    return null;
  }

  return value.match(/([A-K])/i)?.[1]?.toUpperCase() ?? null;
}

export function buildSchoolDisplay(
  typeValue: string | null,
  yearValue: string | null,
  classValue: string | null,
  fallbackClass?: string | null,
) {
  const type = normalizeType(typeValue);
  const year = normalizeYear(typeValue, yearValue);
  const schoolClass = normalizeClass(classValue);

  if (!type && !year && !schoolClass) {
    return fallbackClass?.trim() || "";
  }

  const parts: string[] = [];

  if (type) {
    parts.push(schoolTypes[type].label);
  }

  if (type && year && year in schoolTypes[type].years) {
    parts.push(schoolTypes[type].years[year as keyof (typeof schoolTypes)[typeof type]["years"]]);
  }

  if (schoolClass) {
    parts.push(schoolClass);
  }

  return parts.join(" - ");
}
