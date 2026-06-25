import {
  createOperationalDiscount,
  createOperationalDiscountType,
  deleteOperationalDiscount,
  deleteOperationalDiscountType,
  getOperationalReferenceData,
  updateOperationalDiscount,
  updateOperationalDiscountType,
} from "@/lib/ops-reference-data";

export type PainelDiscount = {
  id: number;
  typeId: number | null;
  typeDescription: string | null;
  name: string;
  applicationType: "percentual" | "valor_fixo" | string | null;
  applicationTypeLabel: string;
  value: string;
  valueLabel: string;
};

export type PainelDiscountType = {
  id: number;
  description: string;
};

export type PainelDiscountListResult = {
  items: PainelDiscount[];
  page: number;
  perPage: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
  discountTypes: PainelDiscountType[];
};

export type PainelDiscountTypeListResult = {
  items: PainelDiscountType[];
  page: number;
  perPage: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
};

export type PainelDiscountFormValues = {
  tipo_id: string;
  nome: string;
  tipo_aplicacao: string;
  valor: string;
};

export type PainelDiscountTypeFormValues = {
  descricao: string;
};

export class PainelDescontosError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelDescontosError";
    this.code = code;
    this.status = status;
  }
}

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function formatMoneyLabel(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function mapApplicationTypeLabel(value: string | null) {
  return value === "percentual" ? "Percentual" : "Valor fixo";
}

function mapDiscount(raw: {
  id: number;
  typeId: number | null;
  typeDescription: string | null;
  name: string;
  applicationType: string | null;
  value: string;
}): PainelDiscount {
  return {
    id: raw.id,
    typeId: raw.typeId,
    typeDescription: raw.typeDescription,
    name: raw.name,
    applicationType: raw.applicationType,
    applicationTypeLabel: mapApplicationTypeLabel(raw.applicationType),
    value: raw.value,
    valueLabel: formatMoneyLabel(raw.value),
  };
}

function paginateItems<T>(items: T[], page: number, perPage: number) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const startIndex = (safePage - 1) * perPage;
  const current = items.slice(startIndex, startIndex + perPage);
  return {
    items: current,
    page: safePage,
    perPage,
    total,
    pageCount,
    start: total === 0 ? 0 : startIndex + 1,
    end: total === 0 ? 0 : startIndex + current.length,
  };
}

export async function listPainelDiscounts(input: {
  page?: unknown;
  perPage?: unknown;
}) {
  const referenceData = await getOperationalReferenceData();
  const page = parsePositiveInteger(input.page, 1);
  const perPage = parsePositiveInteger(input.perPage, 50);
  const mapped = referenceData.discounts.map(mapDiscount);
  const paginated = paginateItems(mapped, page, perPage);

  return {
    ...paginated,
    discountTypes: referenceData.discountTypes.map((type) => ({
      id: type.id,
      description: type.description,
    })),
  } satisfies PainelDiscountListResult;
}

export async function listPainelDiscountTypes(input: {
  page?: unknown;
  perPage?: unknown;
}) {
  const referenceData = await getOperationalReferenceData();
  const page = parsePositiveInteger(input.page, 1);
  const perPage = parsePositiveInteger(input.perPage, 50);
  const paginated = paginateItems(
    referenceData.discountTypes.map((type) => ({
      id: type.id,
      description: type.description,
    })),
    page,
    perPage,
  );

  return paginated satisfies PainelDiscountTypeListResult;
}

export async function getPainelDiscount(id: unknown) {
  const discountId = Number(id);
  if (!Number.isInteger(discountId) || discountId <= 0) {
    throw new PainelDescontosError(
      "invalid_discount_id",
      "Informe um desconto valido.",
      400,
    );
  }

  const referenceData = await getOperationalReferenceData();
  const found = referenceData.discounts.find((item) => item.id === discountId);

  if (!found) {
    throw new PainelDescontosError(
      "discount_not_found",
      "Desconto nao encontrado.",
      404,
    );
  }

  return mapDiscount(found);
}

export async function getPainelDiscountType(id: unknown) {
  const typeId = Number(id);
  if (!Number.isInteger(typeId) || typeId <= 0) {
    throw new PainelDescontosError(
      "invalid_discount_type_id",
      "Informe um tipo de desconto valido.",
      400,
    );
  }

  const referenceData = await getOperationalReferenceData();
  const found = referenceData.discountTypes.find((item) => item.id === typeId);

  if (!found) {
    throw new PainelDescontosError(
      "discount_type_not_found",
      "Tipo de desconto inexistente.",
      404,
    );
  }

  return {
    id: found.id,
    description: found.description,
  } satisfies PainelDiscountType;
}

export async function listPainelDiscountTypeOptions() {
  const referenceData = await getOperationalReferenceData();
  return referenceData.discountTypes.map((type) => ({
    id: type.id,
    description: type.description,
  }));
}

export async function createPainelDiscount(values: PainelDiscountFormValues) {
  return createOperationalDiscount({
    typeId: Number(values.tipo_id),
    name: normalizeText(values.nome),
    applicationType: normalizeText(values.tipo_aplicacao),
    value: normalizeText(values.valor),
  });
}

export async function updatePainelDiscount(id: unknown, values: PainelDiscountFormValues) {
  return updateOperationalDiscount({
    id: Number(id),
    typeId: Number(values.tipo_id),
    name: normalizeText(values.nome),
    applicationType: normalizeText(values.tipo_aplicacao),
    value: normalizeText(values.valor),
  });
}

export async function removePainelDiscount(id: unknown) {
  return deleteOperationalDiscount({
    id: Number(id),
  });
}

export async function createPainelDiscountType(values: PainelDiscountTypeFormValues) {
  return createOperationalDiscountType({
    description: normalizeText(values.descricao),
  });
}

export async function updatePainelDiscountType(
  id: unknown,
  values: PainelDiscountTypeFormValues,
) {
  return updateOperationalDiscountType({
    id: Number(id),
    description: normalizeText(values.descricao),
  });
}

export async function removePainelDiscountType(id: unknown) {
  return deleteOperationalDiscountType({
    id: Number(id),
  });
}

export function asPainelDescontosError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown; status?: unknown };
  if (
    candidate &&
    typeof candidate === "object" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.status === "number"
  ) {
    return new PainelDescontosError(
      candidate.code,
      candidate.message,
      candidate.status,
    );
  }

  if (error instanceof PainelDescontosError) {
    return error;
  }

  return new PainelDescontosError(
    "painel_discounts_unavailable",
    "Nao foi possivel operar descontos agora.",
    500,
  );
}
