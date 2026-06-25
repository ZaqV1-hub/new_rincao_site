import {
  createOperationalCourtesyAuthor,
  deleteOperationalCourtesyAuthor,
  getOperationalReferenceData,
  updateOperationalCourtesyAuthor,
} from "@/lib/ops-reference-data";

export type PainelCortesia = {
  id: number;
  name: string;
};

export type PainelCortesiaListResult = {
  items: PainelCortesia[];
  page: number;
  perPage: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
};

export type PainelCortesiaFormValues = {
  nome: string;
};

export class PainelCortesiasError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelCortesiasError";
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

export async function listPainelCortesias(input: {
  page?: unknown;
  perPage?: unknown;
}) {
  const referenceData = await getOperationalReferenceData();
  const page = parsePositiveInteger(input.page, 1);
  const perPage = parsePositiveInteger(input.perPage, 20);
  const paginated = paginateItems(
    referenceData.courtesyAuthors.map((author) => ({
      id: author.id,
      name: author.name,
    })),
    page,
    perPage,
  );

  return paginated satisfies PainelCortesiaListResult;
}

export async function getPainelCortesia(id: unknown) {
  const courtesyId = Number(id);
  if (!Number.isInteger(courtesyId) || courtesyId <= 0) {
    throw new PainelCortesiasError(
      "invalid_courtesy_author_id",
      "Informe um autorizador de cortesia valido.",
      400,
    );
  }

  const referenceData = await getOperationalReferenceData();
  const found = referenceData.courtesyAuthors.find((item) => item.id === courtesyId);

  if (!found) {
    throw new PainelCortesiasError(
      "courtesy_author_not_found",
      "Autorizador de cortesia nao encontrado.",
      404,
    );
  }

  return {
    id: found.id,
    name: found.name,
  } satisfies PainelCortesia;
}

export async function createPainelCortesia(values: PainelCortesiaFormValues) {
  return createOperationalCourtesyAuthor({
    name: normalizeText(values.nome),
  });
}

export async function updatePainelCortesia(
  id: unknown,
  values: PainelCortesiaFormValues,
) {
  return updateOperationalCourtesyAuthor({
    id: Number(id),
    name: normalizeText(values.nome),
  });
}

export async function removePainelCortesia(id: unknown) {
  return deleteOperationalCourtesyAuthor({
    id: Number(id),
  });
}

export function asPainelCortesiasError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown; status?: unknown };
  if (
    candidate &&
    typeof candidate === "object" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.status === "number"
  ) {
    return new PainelCortesiasError(
      candidate.code,
      candidate.message,
      candidate.status,
    );
  }

  if (error instanceof PainelCortesiasError) {
    return error;
  }

  return new PainelCortesiasError(
    "painel_courtesy_unavailable",
    "Nao foi possivel operar cortesias agora.",
    500,
  );
}
