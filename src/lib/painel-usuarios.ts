import { formatCpf, sanitizeCpf } from "@/lib/cpf";
import {
  asOpsAdminMasterDataError,
  createOpsAdminMasterData,
  deleteOpsAdminMasterData,
  listOpsAdminMasterData,
  updateOpsAdminMasterData,
} from "@/lib/ops-admin-master-data";

type PainelUsuarioRawItem = {
  cpf: string;
  nmusuario: string | null;
  email: string | null;
  stusuario: string | null;
  idpapel: number | null;
  dtcadastro?: string | null;
  dtulogin?: string | null;
  hrulogin?: string | null;
};

export type PainelUsuarioItem = {
  cpf: string;
  cpfLabel: string;
  name: string;
  email: string | null;
  roleId: number | null;
  roleLabel: string;
  status: "ati" | "ina";
  statusLabel: string;
  createdAt: string | null;
  lastLoginLabel: string | null;
};

export type PainelUsuarioListResult = {
  filters: {
    cpf: string;
    nome: string;
    status: string;
  };
  items: PainelUsuarioItem[];
  page: number;
  per: number;
  total: number;
  pageCount: number;
  start: number;
  end: number;
};

export type PainelUsuarioFormValues = {
  cpf: string;
  senha: string;
  csenha: string;
  nmusuario: string;
  email: string;
  idpapel: string;
  stusuario?: string;
};

export type PainelMinhaContaFormValues = {
  senha: string;
  csenha: string;
};

export class PainelUsuariosError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "PainelUsuariosError";
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

function mapRoleLabel(idpapel: number | null) {
  if (idpapel === 1) {
    return "Gerente";
  }

  if (idpapel === 2) {
    return "Funcionario";
  }

  if (idpapel === 3) {
    return "Bilheteria";
  }

  return "-";
}

function mapStatusLabel(status: string | null) {
  return status === "ina" ? "Inativo" : "Ativo";
}

function mapLastLoginLabel(item: PainelUsuarioRawItem) {
  if (!item.dtulogin) {
    return null;
  }

  return item.hrulogin ? `${item.dtulogin} ${item.hrulogin}` : item.dtulogin;
}

function mapUsuario(item: PainelUsuarioRawItem): PainelUsuarioItem {
  const status = item.stusuario === "ina" ? "ina" : "ati";

  return {
    cpf: sanitizeCpf(item.cpf),
    cpfLabel: formatCpf(item.cpf),
    name: normalizeText(item.nmusuario) || "-",
    email: normalizeText(item.email) || null,
    roleId: item.idpapel ?? null,
    roleLabel: mapRoleLabel(item.idpapel ?? null),
    status,
    statusLabel: mapStatusLabel(status),
    createdAt: item.dtcadastro ?? null,
    lastLoginLabel: mapLastLoginLabel(item),
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

function validatePasswordPair(password: string, confirmation: string) {
  if (!password) {
    throw new PainelUsuariosError("invalid_user_password", "Informe a senha.", 400);
  }

  if (password.length > 20) {
    throw new PainelUsuariosError(
      "invalid_user_password",
      "A senha deve ter no maximo 20 caracteres.",
      400,
    );
  }

  if (password !== confirmation) {
    throw new PainelUsuariosError(
      "invalid_user_password_confirmation",
      "A confirmacao da senha e a senha devem ser iguais.",
      400,
    );
  }
}

async function getPainelUsuarioRaw(cpf: unknown) {
  const normalizedCpf = sanitizeCpf(String(cpf ?? ""));

  if (normalizedCpf.length !== 11) {
    throw new PainelUsuariosError("invalid_user_cpf", "Informe um CPF valido.", 400);
  }

  const result = await listOpsAdminMasterData("internal-users");
  const found = (result.items as PainelUsuarioRawItem[]).find(
    (item) => sanitizeCpf(item.cpf) === normalizedCpf,
  );

  if (!found) {
    throw new PainelUsuariosError("user_not_found", "Usuario nao encontrado.", 404);
  }

  return found;
}

export function asPainelUsuariosError(error: unknown) {
  if (error instanceof PainelUsuariosError) {
    return error;
  }

  const mapped = asOpsAdminMasterDataError(error);
  return new PainelUsuariosError(mapped.code, mapped.message, mapped.status);
}

export async function listPainelUsuarios(input: Record<string, unknown>) {
  const cpf = sanitizeCpf(String(input.cpf ?? ""));
  const nome = normalizeText(input.nome);
  const status = normalizeStatus(input.status);
  const page = parsePositiveInteger(input.page, 1);
  const per = parsePositiveInteger(input.per, 30);
  const result = await listOpsAdminMasterData("internal-users");
  const mapped = (result.items as PainelUsuarioRawItem[]).map(mapUsuario);

  const filtered = mapped.filter((item) => {
    if (status) {
      return item.status === status;
    }

    return item.status === "ati";
  }).filter((item) => (cpf ? item.cpf.includes(cpf) : true))
    .filter((item) =>
      nome
        ? item.name.toLocaleLowerCase("pt-BR").includes(nome.toLocaleLowerCase("pt-BR"))
        : true,
    );

  return {
    filters: {
      cpf: formatCpf(cpf),
      nome,
      status,
    },
    ...paginateItems(filtered, page, per),
  } satisfies PainelUsuarioListResult;
}

export async function getPainelUsuario(cpf: unknown) {
  const raw = await getPainelUsuarioRaw(cpf);
  return mapUsuario(raw);
}

export async function createPainelUsuario(values: PainelUsuarioFormValues) {
  const cpf = sanitizeCpf(values.cpf);
  const senha = normalizeText(values.senha);
  const csenha = normalizeText(values.csenha);
  const nmusuario = normalizeText(values.nmusuario);
  const email = normalizeText(values.email);
  const idpapel = Number(values.idpapel);

  if (!cpf || cpf.length !== 11) {
    throw new PainelUsuariosError("invalid_user_cpf", "Informe um CPF valido.", 400);
  }

  if (!nmusuario) {
    throw new PainelUsuariosError("invalid_user_name", "Informe o nome do usuario.", 400);
  }

  if (!Number.isInteger(idpapel) || ![1, 2, 3].includes(idpapel)) {
    throw new PainelUsuariosError("invalid_user_role", "Informe um papel valido.", 400);
  }

  validatePasswordPair(senha, csenha);

  return createOpsAdminMasterData("internal-users", {
    values: {
      cpf,
      password: senha,
      name: nmusuario,
      email,
      roleId: idpapel,
      status: "ati",
    },
  });
}

export async function updatePainelUsuario(cpf: unknown, values: PainelUsuarioFormValues) {
  const normalizedCpf = sanitizeCpf(String(cpf ?? ""));
  const nmusuario = normalizeText(values.nmusuario);
  const email = normalizeText(values.email);
  const idpapel = Number(values.idpapel);

  if (!normalizedCpf || normalizedCpf.length !== 11) {
    throw new PainelUsuariosError("invalid_user_cpf", "Informe um CPF valido.", 400);
  }

  if (!nmusuario) {
    throw new PainelUsuariosError("invalid_user_name", "Informe o nome do usuario.", 400);
  }

  if (!Number.isInteger(idpapel) || ![1, 2, 3].includes(idpapel)) {
    throw new PainelUsuariosError("invalid_user_role", "Informe um papel valido.", 400);
  }

  return updateOpsAdminMasterData("internal-users", {
    id: normalizedCpf,
    values: {
      cpf: normalizedCpf,
      name: nmusuario,
      email,
      roleId: idpapel,
      status: normalizeStatus(values.stusuario) || "ati",
    },
  });
}

export async function togglePainelUsuarioStatus(input: {
  cpf: unknown;
  currentActorCpf: string | null;
  actor?: {
    name?: string | null;
    cpf?: string | null;
  } | null;
}) {
  const normalizedCpf = sanitizeCpf(String(input.cpf ?? ""));
  const currentActorCpf = sanitizeCpf(String(input.currentActorCpf ?? ""));

  if (normalizedCpf && currentActorCpf && normalizedCpf === currentActorCpf) {
    throw new PainelUsuariosError(
      "user_self_status_forbidden",
      "Nao e permitido alterar o proprio status.",
      400,
    );
  }

  const current = await getPainelUsuarioRaw(normalizedCpf);
  const nextStatus = current.stusuario === "ati" ? "ina" : "ati";

  return updateOpsAdminMasterData("internal-users", {
    actor: input.actor,
    id: normalizedCpf,
    values: {
      status: nextStatus,
    },
  });
}

export async function removePainelUsuario(input: {
  cpf: unknown;
  actor?: {
    name?: string | null;
    cpf?: string | null;
  } | null;
}) {
  const normalizedCpf = sanitizeCpf(String(input.cpf ?? ""));

  if (!normalizedCpf || normalizedCpf.length !== 11) {
    throw new PainelUsuariosError("invalid_user_cpf", "Informe um CPF valido.", 400);
  }

  return deleteOpsAdminMasterData("internal-users", {
    actor: input.actor,
    id: normalizedCpf,
  });
}

export async function updatePainelMinhaContaSenha(input: {
  cpf: unknown;
  values: PainelMinhaContaFormValues;
}) {
  const normalizedCpf = sanitizeCpf(String(input.cpf ?? ""));
  const senha = normalizeText(input.values.senha);
  const csenha = normalizeText(input.values.csenha);

  if (!normalizedCpf || normalizedCpf.length !== 11) {
    throw new PainelUsuariosError("invalid_user_cpf", "Informe um CPF valido.", 400);
  }

  validatePasswordPair(senha, csenha);

  return updateOpsAdminMasterData("internal-users", {
    id: normalizedCpf,
    values: {
      password: senha,
    },
  });
}
