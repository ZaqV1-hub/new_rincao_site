import {
  asOpsAdminMasterDataError,
  createOpsAdminMasterData,
  deleteOpsAdminMasterData,
  listOpsAdminMasterData,
  updateOpsAdminMasterData,
} from "@/lib/ops-admin-master-data";

type InformacaoRawItem = {
  idinformacao: number;
  nome: string | null;
  texto: string | null;
  status: string | null;
};

export type PainelInformacaoItem = {
  id: number;
  name: string;
  text: string;
  paragraphs: string[];
  status: "ati" | "ina";
  statusLabel: string;
};

export type PainelInformacoesListResult = {
  filters: {
    nome: string;
    status: string;
  };
  items: PainelInformacaoItem[];
  page: number;
  per: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
};

export type PainelInformacaoFormValues = {
  nome: string;
  texto: string;
  status?: string;
};

export class PainelInformacoesError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelInformacoesError";
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

function mapStatusLabel(status: string | null) {
  return status === "ina" ? "Inativo" : "Ativo";
}

function mapItem(item: InformacaoRawItem): PainelInformacaoItem {
  const status = item.status === "ina" ? "ina" : "ati";
  const text = normalizeText(item.texto);

  return {
    id: Number(item.idinformacao),
    name: normalizeText(item.nome) || "-",
    text,
    paragraphs: text
      .split(";")
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
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

async function getPainelInformacaoRaw(id: unknown) {
  const infoId = Number(id);

  if (!Number.isInteger(infoId) || infoId <= 0) {
    throw new PainelInformacoesError(
      "invalid_information_id",
      "Informe uma informacao valida.",
      400,
    );
  }

  const result = await listOpsAdminMasterData("information");
  const found = (result.items as InformacaoRawItem[]).find(
    (item) => Number(item.idinformacao) === infoId,
  );

  if (!found) {
    throw new PainelInformacoesError(
      "information_not_found",
      "Informacao nao encontrada.",
      404,
    );
  }

  return found;
}

export function asPainelInformacoesError(error: unknown) {
  if (error instanceof PainelInformacoesError) {
    return error;
  }

  const mapped = asOpsAdminMasterDataError(error);
  return new PainelInformacoesError(mapped.code, mapped.message, mapped.status);
}

export async function listPainelInformacoes(input: Record<string, unknown>) {
  const nome = normalizeText(input.nome);
  const status = normalizeStatus(input.status);
  const page = parsePositiveInteger(input.page, 1);
  const per = parsePositiveInteger(input.per, 10);
  const result = await listOpsAdminMasterData("information");
  const mapped = (result.items as InformacaoRawItem[]).map(mapItem);

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
  } satisfies PainelInformacoesListResult;
}

export async function getPainelInformacao(id: unknown) {
  const raw = await getPainelInformacaoRaw(id);
  return mapItem(raw);
}

export async function createPainelInformacao(values: PainelInformacaoFormValues) {
  const name = normalizeText(values.nome);
  const text = normalizeText(values.texto);

  if (!name) {
    throw new PainelInformacoesError(
      "invalid_information_name",
      "Informe o nome da informacao.",
      400,
    );
  }

  if (!text) {
    throw new PainelInformacoesError(
      "invalid_information_text",
      "Informe o texto da informacao.",
      400,
    );
  }

  return createOpsAdminMasterData("information", {
    values: {
      name,
      text,
      status: "ati",
    },
  });
}

export async function updatePainelInformacao(
  id: unknown,
  values: PainelInformacaoFormValues,
) {
  const infoId = Number(id);
  const name = normalizeText(values.nome);
  const text = normalizeText(values.texto);

  if (!Number.isInteger(infoId) || infoId <= 0) {
    throw new PainelInformacoesError(
      "invalid_information_id",
      "Informe uma informacao valida.",
      400,
    );
  }

  if (!name) {
    throw new PainelInformacoesError(
      "invalid_information_name",
      "Informe o nome da informacao.",
      400,
    );
  }

  if (!text) {
    throw new PainelInformacoesError(
      "invalid_information_text",
      "Informe o texto da informacao.",
      400,
    );
  }

  return updateOpsAdminMasterData("information", {
    id: infoId,
    values: {
      name,
      text,
      status: normalizeStatus(values.status) || "ati",
    },
  });
}

export async function togglePainelInformacaoStatus(input: {
  id: unknown;
  actor?: {
    name?: string | null;
    cpf?: string | null;
  } | null;
}) {
  const current = await getPainelInformacaoRaw(input.id);
  const nextStatus = current.status === "ati" ? "ina" : "ati";

  return updateOpsAdminMasterData("information", {
    actor: input.actor,
    id: Number(current.idinformacao),
    values: {
      status: nextStatus,
    },
  });
}

export async function removePainelInformacao(input: {
  id: unknown;
  actor?: {
    name?: string | null;
    cpf?: string | null;
  } | null;
}) {
  const infoId = Number(input.id);

  if (!Number.isInteger(infoId) || infoId <= 0) {
    throw new PainelInformacoesError(
      "invalid_information_id",
      "Informe uma informacao valida.",
      400,
    );
  }

  return deleteOpsAdminMasterData("information", {
    actor: input.actor,
    id: infoId,
  });
}
