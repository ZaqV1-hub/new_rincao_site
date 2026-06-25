import {
  asOpsAdminMasterDataError,
  createOpsAdminMasterData,
  deleteOpsAdminMasterData,
  listOpsAdminMasterData,
  updateOpsAdminMasterData,
} from "@/lib/ops-admin-master-data";
import { listPainelConvenioPriceTableOptions } from "@/lib/painel-convenios";

type CategoriaSocioRawItem = {
  idsociocateg: number;
  nmcategoria: string | null;
  idtabpreco: number | null;
};

type PriceTableRawItem = {
  idtabpreco: number;
  nmtabpreco: string | null;
};

export type PainelCategoriaSocioItem = {
  id: number;
  name: string;
  priceTableId: number | null;
  priceTableName: string | null;
};

export type PainelCategoriaSocioListResult = {
  filters: {
    idtabpreco: string;
  };
  items: PainelCategoriaSocioItem[];
  page: number;
  per: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
  priceTableOptions: Array<{ id: number; name: string }>;
};

export type PainelCategoriaSocioFormValues = {
  nmcategoria: string;
  idtabpreco: string;
};

export class PainelCategoriaSocioError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelCategoriaSocioError";
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

function paginateItems<T>(items: T[], page: number, per: number) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / per));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const startIndex = (safePage - 1) * per;
  const current = items.slice(startIndex, startIndex + per);

  return {
    items: current,
    page: safePage,
    per,
    total,
    pageCount,
    start: total === 0 ? 0 : startIndex + 1,
    end: total === 0 ? 0 : startIndex + current.length,
  };
}

async function listPriceTablesMap() {
  const result = await listOpsAdminMasterData("price-tables");
  const map = new Map<number, string>();

  for (const item of result.items as PriceTableRawItem[]) {
    if (item.idtabpreco != null) {
      map.set(Number(item.idtabpreco), normalizeText(item.nmtabpreco) || "-");
    }
  }

  return map;
}

async function getPainelCategoriaSocioRaw(id: unknown) {
  const categoryId = Number(id);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new PainelCategoriaSocioError(
      "invalid_membership_category_id",
      "Informe uma categoria de socio valida.",
      400,
    );
  }

  const result = await listOpsAdminMasterData("membership-categories");
  const found = (result.items as CategoriaSocioRawItem[]).find(
    (item) => Number(item.idsociocateg) === categoryId,
  );

  if (!found) {
    throw new PainelCategoriaSocioError(
      "membership_category_not_found",
      "Categoria de socio nao encontrada.",
      404,
    );
  }

  return found;
}

export function asPainelCategoriaSocioError(error: unknown) {
  if (error instanceof PainelCategoriaSocioError) {
    return error;
  }

  const mapped = asOpsAdminMasterDataError(error);
  return new PainelCategoriaSocioError(mapped.code, mapped.message, mapped.status);
}

export async function getPainelCategoriaSocioFormContext(currentPriceTableId?: number | null) {
  return {
    priceTableOptions: await listPainelConvenioPriceTableOptions(currentPriceTableId),
  };
}

export async function listPainelCategoriasSocio(input: Record<string, unknown>) {
  const priceTableId = Number(input.idtabpreco);
  const page = parsePositiveInteger(input.page, 1);
  const per = parsePositiveInteger(input.per, 30);
  const [categoriesResult, priceTableMap, priceTableOptions] = await Promise.all([
    listOpsAdminMasterData("membership-categories"),
    listPriceTablesMap(),
    getPainelCategoriaSocioFormContext(),
  ]);

  const mapped = (categoriesResult.items as CategoriaSocioRawItem[])
    .map((item) => ({
      id: Number(item.idsociocateg),
      name: normalizeText(item.nmcategoria) || "-",
      priceTableId: item.idtabpreco != null ? Number(item.idtabpreco) : null,
      priceTableName:
        item.idtabpreco != null
          ? priceTableMap.get(Number(item.idtabpreco)) ?? null
          : null,
    }))
    .filter((item) =>
      Number.isInteger(priceTableId) && priceTableId > 0
        ? item.priceTableId === priceTableId
        : true,
    );

  return {
    filters: {
      idtabpreco: Number.isInteger(priceTableId) && priceTableId > 0 ? String(priceTableId) : "",
    },
    ...paginateItems(mapped, page, per),
    priceTableOptions: priceTableOptions.priceTableOptions,
  } satisfies PainelCategoriaSocioListResult;
}

export async function getPainelCategoriaSocio(id: unknown) {
  const raw = await getPainelCategoriaSocioRaw(id);
  const priceTableMap = await listPriceTablesMap();

  return {
    id: Number(raw.idsociocateg),
    name: normalizeText(raw.nmcategoria) || "-",
    priceTableId: raw.idtabpreco != null ? Number(raw.idtabpreco) : null,
    priceTableName:
      raw.idtabpreco != null
        ? priceTableMap.get(Number(raw.idtabpreco)) ?? null
        : null,
  } satisfies PainelCategoriaSocioItem;
}

export async function createPainelCategoriaSocio(values: PainelCategoriaSocioFormValues) {
  const name = normalizeText(values.nmcategoria);
  const priceTableId = Number(values.idtabpreco);

  if (!name) {
    throw new PainelCategoriaSocioError(
      "invalid_membership_category_name",
      "Informe o nome da categoria de socio.",
      400,
    );
  }

  if (!Number.isInteger(priceTableId) || priceTableId <= 0) {
    throw new PainelCategoriaSocioError(
      "invalid_membership_category_price_table",
      "Informe uma tabela de preco valida.",
      400,
    );
  }

  return createOpsAdminMasterData("membership-categories", {
    values: {
      name,
      priceTableId,
    },
  });
}

export async function updatePainelCategoriaSocio(
  id: unknown,
  values: PainelCategoriaSocioFormValues,
) {
  const categoryId = Number(id);
  const name = normalizeText(values.nmcategoria);
  const priceTableId = Number(values.idtabpreco);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new PainelCategoriaSocioError(
      "invalid_membership_category_id",
      "Informe uma categoria de socio valida.",
      400,
    );
  }

  if (!name) {
    throw new PainelCategoriaSocioError(
      "invalid_membership_category_name",
      "Informe o nome da categoria de socio.",
      400,
    );
  }

  if (!Number.isInteger(priceTableId) || priceTableId <= 0) {
    throw new PainelCategoriaSocioError(
      "invalid_membership_category_price_table",
      "Informe uma tabela de preco valida.",
      400,
    );
  }

  return updateOpsAdminMasterData("membership-categories", {
    id: categoryId,
    values: {
      name,
      priceTableId,
    },
  });
}

export async function removePainelCategoriaSocio(input: {
  id: unknown;
  actor?: {
    name?: string | null;
    cpf?: string | null;
  } | null;
}) {
  const categoryId = Number(input.id);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new PainelCategoriaSocioError(
      "invalid_membership_category_id",
      "Informe uma categoria de socio valida.",
      400,
    );
  }

  return deleteOpsAdminMasterData("membership-categories", {
    actor: input.actor,
    id: categoryId,
  });
}
