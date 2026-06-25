import {
  asOpsAdminMasterDataError,
  createOpsAdminMasterData,
  deleteOpsAdminMasterData,
  listOpsAdminMasterData,
  updateOpsAdminMasterData,
} from "@/lib/ops-admin-master-data";

type TabelaPrecoRawItem = {
  idtabpreco: number;
  nmtabpreco: string | null;
  vlnormal: string | null;
  vlinfant: string | null;
  vlnormalbil: string | null;
  vlinfantbil: string | null;
  sttabpreco: string | null;
};

export type PainelTabelaPrecoItem = {
  id: number;
  name: string;
  normalValue: string;
  childValue: string;
  gateNormalValue: string;
  gateChildValue: string;
  status: "ati" | "ina";
  statusLabel: string;
};

export type PainelTabelaPrecoListResult = {
  filters: {
    nome: string;
    status: string;
  };
  items: PainelTabelaPrecoItem[];
  page: number;
  per: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
};

export type PainelTabelaPrecoFormValues = {
  nmtabpreco: string;
  vlnormal: string;
  vlinfant: string;
  vlnormalbil: string;
  vlinfantbil: string;
  sttabpreco?: string;
};

export class PainelTabelaPrecoError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelTabelaPrecoError";
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

function normalizeStatus(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === "ina" ? "ina" : normalized === "ati" ? "ati" : "";
}

function formatMoney(value: string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function mapStatusLabel(status: string | null) {
  return status === "ina" ? "Inativo" : "Ativo";
}

function mapItem(item: TabelaPrecoRawItem): PainelTabelaPrecoItem {
  const status = item.sttabpreco === "ina" ? "ina" : "ati";

  return {
    id: Number(item.idtabpreco),
    name: normalizeText(item.nmtabpreco) || "-",
    normalValue: formatMoney(item.vlnormal),
    childValue: formatMoney(item.vlinfant),
    gateNormalValue: formatMoney(item.vlnormalbil),
    gateChildValue: formatMoney(item.vlinfantbil),
    status,
    statusLabel: mapStatusLabel(status),
  };
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

async function getPainelTabelaPrecoRaw(id: unknown) {
  const tableId = Number(id);

  if (!Number.isInteger(tableId) || tableId <= 0) {
    throw new PainelTabelaPrecoError(
      "invalid_price_table_id",
      "Informe uma tabela de preco valida.",
      400,
    );
  }

  const result = await listOpsAdminMasterData("price-tables");
  const found = (result.items as TabelaPrecoRawItem[]).find(
    (item) => Number(item.idtabpreco) === tableId,
  );

  if (!found) {
    throw new PainelTabelaPrecoError(
      "price_table_not_found",
      "Tabela de preco nao encontrada.",
      404,
    );
  }

  return found;
}

export function asPainelTabelaPrecoError(error: unknown) {
  if (error instanceof PainelTabelaPrecoError) {
    return error;
  }

  const mapped = asOpsAdminMasterDataError(error);
  return new PainelTabelaPrecoError(mapped.code, mapped.message, mapped.status);
}

export async function listPainelTabelaPreco(input: Record<string, unknown>) {
  const nome = normalizeText(input.nome);
  const status = normalizeStatus(input.status);
  const page = parsePositiveInteger(input.page, 1);
  const per = parsePositiveInteger(input.per, 30);
  const result = await listOpsAdminMasterData("price-tables");
  const mapped = (result.items as TabelaPrecoRawItem[]).map(mapItem);

  const filtered = mapped
    .filter((item) => {
      if (status) {
        return item.status === status;
      }

      return item.status === "ati";
    })
    .filter((item) =>
      nome
        ? item.name.toLocaleLowerCase("pt-BR").includes(nome.toLocaleLowerCase("pt-BR"))
        : true,
    );

  return {
    filters: {
      nome,
      status,
    },
    ...paginateItems(filtered, page, per),
  } satisfies PainelTabelaPrecoListResult;
}

export async function getPainelTabelaPreco(id: unknown) {
  const raw = await getPainelTabelaPrecoRaw(id);
  return mapItem(raw);
}

export async function createPainelTabelaPreco(values: PainelTabelaPrecoFormValues) {
  const name = normalizeText(values.nmtabpreco);

  if (!name) {
    throw new PainelTabelaPrecoError(
      "invalid_price_table_name",
      "Informe o nome da tabela de preco.",
      400,
    );
  }

  return createOpsAdminMasterData("price-tables", {
    values: {
      name,
      normalValue: normalizeText(values.vlnormal),
      childValue: normalizeText(values.vlinfant),
      gateNormalValue: normalizeText(values.vlnormalbil),
      gateChildValue: normalizeText(values.vlinfantbil),
      status: "ati",
    },
  });
}

export async function updatePainelTabelaPreco(
  id: unknown,
  values: PainelTabelaPrecoFormValues,
) {
  const tableId = Number(id);
  const name = normalizeText(values.nmtabpreco);

  if (!Number.isInteger(tableId) || tableId <= 0) {
    throw new PainelTabelaPrecoError(
      "invalid_price_table_id",
      "Informe uma tabela de preco valida.",
      400,
    );
  }

  if (!name) {
    throw new PainelTabelaPrecoError(
      "invalid_price_table_name",
      "Informe o nome da tabela de preco.",
      400,
    );
  }

  return updateOpsAdminMasterData("price-tables", {
    id: tableId,
    values: {
      name,
      normalValue: normalizeText(values.vlnormal),
      childValue: normalizeText(values.vlinfant),
      gateNormalValue: normalizeText(values.vlnormalbil),
      gateChildValue: normalizeText(values.vlinfantbil),
      status: normalizeStatus(values.sttabpreco) || "ati",
    },
  });
}

export async function togglePainelTabelaPrecoStatus(input: {
  id: unknown;
  actor?: {
    name?: string | null;
    cpf?: string | null;
  } | null;
}) {
  const current = await getPainelTabelaPrecoRaw(input.id);
  const nextStatus = current.sttabpreco === "ati" ? "ina" : "ati";

  return updateOpsAdminMasterData("price-tables", {
    actor: input.actor,
    id: Number(current.idtabpreco),
    values: {
      status: nextStatus,
    },
  });
}

export async function removePainelTabelaPreco(input: {
  id: unknown;
  actor?: {
    name?: string | null;
    cpf?: string | null;
  } | null;
}) {
  const tableId = Number(input.id);

  if (!Number.isInteger(tableId) || tableId <= 0) {
    throw new PainelTabelaPrecoError(
      "invalid_price_table_id",
      "Informe uma tabela de preco valida.",
      400,
    );
  }

  return deleteOpsAdminMasterData("price-tables", {
    actor: input.actor,
    id: tableId,
  });
}
