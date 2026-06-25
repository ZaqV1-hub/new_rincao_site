import { getIngressoDbPool } from "@/lib/ingresso-db";
import { hashPasswordForLegacyUser } from "@/lib/password-hashing";
import type { AuthUser } from "@/lib/auth-contracts";
import { isValidCpf, sanitizeCpf } from "@/lib/cpf";
import {
  getLegacyPanelResources,
  getLegacyPanelRoleName,
  getOperationsPermissionsForLegacyPanelRole,
  isLegacyPanelRoleId,
  mapLegacyPanelRoleToOperationsRole,
  type LegacyPanelResource,
  type LegacyPanelRoleId,
  type LegacyPanelRoleName,
} from "@/lib/painel-access";
import type {
  OperationsPermission,
  OperationsRole,
} from "@/lib/ops-permissions";

type UserRow = {
  cpf: string;
  nmusuario: string;
  email: string | null;
  stusuario: string | null;
  idpapel?: number | null;
};

type UserProfileRow = UserRow & {
  rg: string | null;
  dtnascimento: string | null;
  sexo: string | null;
  telefone: string | null;
  celular: string | null;
  endereco: string | null;
  numero: string | null;
  cep: string | null;
  bairro: string | null;
  uf: string | null;
  cidade: number | null;
  complemento: string | null;
  nmcidade: string | null;
};

export type AuthenticatedUser = AuthUser & {
  cpf: string;
  status: string | null;
};

export type PublicUserProfile = AuthenticatedUser & {
  rg: string | null;
  birthDate: string | null;
  sex: "m" | "f" | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  number: string | null;
  cep: string | null;
  district: string | null;
  uf: string | null;
  cityId: number | null;
  cityName: string | null;
  complement: string | null;
};

export type CustomerAgreement = {
  id: number;
  name: string;
};

export type CustomerAccountSnapshot = {
  profile: PublicUserProfile;
  userType: "ASSOCIADO / CONVENIADO" | "ASSOCIADO" | "CONVENIADO" | "NORMAL";
  agreements: CustomerAgreement[];
};

export type AuthenticatedPanelUser = AuthenticatedUser & {
  roleId: LegacyPanelRoleId | null;
  roleName: LegacyPanelRoleName | null;
  legacyResources: LegacyPanelResource[];
  operationsRole: OperationsRole | null;
  permissions: OperationsPermission[];
};

export type PublicUserProfileInput = {
  name: string;
  email: string;
  rg: string | null;
  birthDate: string;
  sex: "m" | "f";
  phone: string | null;
  mobile: string | null;
  address: string;
  number: string | null;
  cep: string;
  district: string;
  uf: string;
  cityId: number;
  complement: string | null;
};

export type PublicUserRegistrationInput = PublicUserProfileInput & {
  cpf: string;
  password: string;
};

export type UfOption = {
  id: string;
  name: string;
};

export type CityOption = {
  id: number;
  name: string;
};

export type CityLookup = CityOption & {
  uf: string;
};

type CustomerAgreementRow = {
  idconvenio: number;
  nmconvenio: string | null;
};

type CustomerMembershipRow = {
  stsocio: string | null;
};

export { isValidCpf, sanitizeCpf };

function maskCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4");
}

function mapUser(row: UserRow): AuthenticatedUser {
  const cpf = sanitizeCpf(row.cpf);

  return {
    cpf,
    cpfMasked: maskCpf(cpf),
    name: row.nmusuario,
    email: row.email,
    status: row.stusuario?.trim() ?? null,
  };
}

function mapPanelUser(row: UserRow): AuthenticatedPanelUser {
  const user = mapUser(row);
  const rawRoleId = row.idpapel ?? null;
  const roleId: LegacyPanelRoleId | null = isLegacyPanelRoleId(rawRoleId)
    ? rawRoleId
    : null;

  return {
    ...user,
    roleId,
    roleName: roleId ? getLegacyPanelRoleName(roleId) : null,
    legacyResources: roleId ? getLegacyPanelResources(roleId) : [],
    operationsRole: roleId ? mapLegacyPanelRoleToOperationsRole(roleId) : null,
    permissions: roleId ? getOperationsPermissionsForLegacyPanelRole(roleId) : [],
  };
}

function mapProfile(row: UserProfileRow): PublicUserProfile {
  const user = mapUser(row);
  const sex = row.sexo?.trim().toLowerCase();

  return {
    ...user,
    rg: row.rg?.trim() || null,
    birthDate: row.dtnascimento,
    sex: sex === "m" || sex === "f" ? sex : null,
    phone: row.telefone?.trim() || null,
    mobile: row.celular?.trim() || null,
    address: row.endereco?.trim() || null,
    number: row.numero?.trim() || null,
    cep: row.cep?.trim() || null,
    district: row.bairro?.trim() || null,
    uf: row.uf?.trim() || null,
    cityId: row.cidade,
    cityName: row.nmcidade?.trim() || null,
    complement: row.complemento?.trim() || null,
  };
}

function legacyPasswordHash(password: string) {
  // The legacy Zend app stores public user passwords as MD5; keep this only for parity.
  return hashPasswordForLegacyUser(password);
}

export async function authenticatePublicUser(cpf: string, password: string) {
  const pool = getIngressoDbPool();
  const result = await pool.query<UserRow>(
    `
      SELECT cpf, nmusuario, email, stusuario
      FROM usuario
      WHERE cpf = $1
        AND senha = $2
      LIMIT 1
    `,
    [sanitizeCpf(cpf), legacyPasswordHash(password)],
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const user = mapUser(row);

  if (user.status !== "ati") {
    return user;
  }

  await pool.query(
    `
      UPDATE usuario
      SET dtulogin = CURRENT_DATE,
          hrulogin = CURRENT_TIME
      WHERE cpf = $1
    `,
    [user.cpf],
  );

  return user;
}

export async function authenticatePanelUser(cpf: string, password: string) {
  const pool = getIngressoDbPool();
  const result = await pool.query<UserRow>(
    `
      SELECT cpf, nmusuario, email, stusuario, idpapel
      FROM usuario
      WHERE cpf = $1
        AND senha = $2
      LIMIT 1
    `,
    [sanitizeCpf(cpf), legacyPasswordHash(password)],
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const user = mapPanelUser(row);

  if (user.status !== "ati" || user.roleId === null) {
    return user;
  }

  await pool.query(
    `
      UPDATE usuario
      SET dtulogin = CURRENT_DATE,
          hrulogin = CURRENT_TIME
      WHERE cpf = $1
    `,
    [user.cpf],
  );

  return user;
}

export async function getActivePublicUserByCpf(cpf: string) {
  const pool = getIngressoDbPool();
  const result = await pool.query<UserRow>(
    `
      SELECT cpf, nmusuario, email, stusuario
      FROM usuario
      WHERE cpf = $1
      LIMIT 1
    `,
    [sanitizeCpf(cpf)],
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const user = mapUser(row);

  return user.status === "ati" ? user : null;
}

export async function findPublicUserByCpf(cpf: string) {
  const pool = getIngressoDbPool();
  const result = await pool.query<UserRow>(
    `
      SELECT cpf, nmusuario, email, stusuario
      FROM usuario
      WHERE cpf = $1
      LIMIT 1
    `,
    [sanitizeCpf(cpf)],
  );
  const row = result.rows[0];

  return row ? mapUser(row) : null;
}

export async function getActivePublicUserProfileByCpf(cpf: string) {
  const pool = getIngressoDbPool();
  const result = await pool.query<UserProfileRow>(
    `
      SELECT
        usuario.cpf,
        usuario.nmusuario,
        usuario.email,
        usuario.stusuario,
        usuario.rg,
        usuario.dtnascimento::text,
        usuario.sexo,
        usuario.telefone,
        usuario.celular,
        usuario.endereco,
        usuario.numero::text,
        usuario.cep,
        usuario.bairro,
        usuario.uf,
        usuario.cidade,
        usuario.complemento,
        cidade.nmcidade
      FROM usuario
      LEFT JOIN cidade ON cidade.idcidade = usuario.cidade
      WHERE usuario.cpf = $1
      LIMIT 1
    `,
    [sanitizeCpf(cpf)],
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const user = mapProfile(row);

  return user.status === "ati" ? user : null;
}

export async function getCustomerAccountSnapshotByCpf(cpf: string) {
  const profile = await getActivePublicUserProfileByCpf(cpf);

  if (!profile) {
    return null;
  }

  const pool = getIngressoDbPool();
  const [membershipResult, agreementResult] = await Promise.all([
    pool.query<CustomerMembershipRow>(
      `
        SELECT stsocio
        FROM socio
        WHERE cpf = $1
        LIMIT 1
      `,
      [sanitizeCpf(cpf)],
    ),
    pool.query<CustomerAgreementRow>(
      `
        SELECT convenio.idconvenio, convenio.nmconvenio
        FROM conveniado
        JOIN convenio ON convenio.idconvenio = conveniado.idconvenio
        WHERE conveniado.cpf = $1
          AND convenio.stconvenio = 'ati'
          AND conveniado.stconveniado = 'ati'
        ORDER BY convenio.nmconvenio ASC
      `,
      [sanitizeCpf(cpf)],
    ),
  ]);

  const isAssociate = membershipResult.rows[0]?.stsocio?.trim() === "ati";
  const agreements = agreementResult.rows
    .filter((row) => row.nmconvenio?.trim())
    .map((row) => ({
      id: row.idconvenio,
      name: row.nmconvenio!.trim(),
    }));

  let userType: CustomerAccountSnapshot["userType"] = "NORMAL";

  if (isAssociate && agreements.length > 0) {
    userType = "ASSOCIADO / CONVENIADO";
  } else if (isAssociate) {
    userType = "ASSOCIADO";
  } else if (agreements.length > 0) {
    userType = "CONVENIADO";
  }

  return {
    profile,
    userType,
    agreements,
  } satisfies CustomerAccountSnapshot;
}

export async function listProfileUfs() {
  const pool = getIngressoDbPool();
  const result = await pool.query<UfOption>(
    `
      SELECT iduf AS id, nmuf AS name
      FROM uf
      ORDER BY nmuf ASC
    `,
  );

  return result.rows;
}

export async function listProfileCitiesByUf(uf: string) {
  const pool = getIngressoDbPool();
  const result = await pool.query<CityOption>(
    `
      SELECT idcidade AS id, nmcidade AS name
      FROM cidade
      WHERE iduf = $1
      ORDER BY
        CASE WHEN $1 = 'SP' AND idcidade = 9668 THEN 0 ELSE 1 END,
        nmcidade ASC
    `,
    [uf],
  );

  return result.rows;
}

export async function ensureProfileUf(input: UfOption) {
  const pool = getIngressoDbPool();
  const normalizedId = String(input.id ?? "").trim().toUpperCase();
  const normalizedName = String(input.name ?? "").trim();

  if (!normalizedId || !normalizedName) {
    throw new Error("invalid_profile_uf");
  }

  const existing = await pool.query<UfOption>(
    `
      SELECT iduf AS id, nmuf AS name
      FROM uf
      WHERE iduf = $1
      LIMIT 1
    `,
    [normalizedId],
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  await pool.query(
    `
      INSERT INTO uf (iduf, nmuf)
      VALUES ($1, $2)
    `,
    [normalizedId, normalizedName],
  );

  return {
    id: normalizedId,
    name: normalizedName,
  } satisfies UfOption;
}

export async function ensureProfileCity(input: {
  uf: string;
  name: string;
}) {
  const pool = getIngressoDbPool();
  const normalizedUf = String(input.uf ?? "").trim().toUpperCase();
  const normalizedName = String(input.name ?? "").trim();

  if (!normalizedUf || !normalizedName) {
    throw new Error("invalid_profile_city");
  }

  const existing = await pool.query<CityOption>(
    `
      SELECT idcidade AS id, nmcidade AS name
      FROM cidade
      WHERE iduf = $1
        AND lower(trim(nmcidade)) = lower(trim($2))
      ORDER BY idcidade ASC
      LIMIT 1
    `,
    [normalizedUf, normalizedName],
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const nextIdResult = await pool.query<{ next_id: number }>(
    `
      SELECT COALESCE(MAX(idcidade), 0) + 1 AS next_id
      FROM cidade
    `,
  );
  const nextId = Number(nextIdResult.rows[0]?.next_id ?? 0);

  await pool.query(
    `
      INSERT INTO cidade (idcidade, nmcidade, iduf)
      VALUES ($1, $2, $3)
    `,
    [nextId, normalizedName, normalizedUf],
  );

  return {
    id: nextId,
    name: normalizedName,
  } satisfies CityOption;
}

export async function getProfileCityById(cityId: number) {
  const pool = getIngressoDbPool();
  const result = await pool.query<CityLookup>(
    `
      SELECT idcidade AS id, nmcidade AS name, iduf AS uf
      FROM cidade
      WHERE idcidade = $1
      LIMIT 1
    `,
    [cityId],
  );

  return result.rows[0] ?? null;
}

export async function findPublicUserByEmail(email: string) {
  const pool = getIngressoDbPool();
  const result = await pool.query<UserRow>(
    `
      SELECT cpf, nmusuario, email, stusuario
      FROM usuario
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [email],
  );
  const row = result.rows[0];

  return row ? mapUser(row) : null;
}

export async function createPublicUser(input: PublicUserRegistrationInput) {
  const pool = getIngressoDbPool();
  const result = await pool.query<UserRow>(
    `
      INSERT INTO usuario (
        cpf,
        senha,
        nmusuario,
        rg,
        dtnascimento,
        sexo,
        email,
        telefone,
        celular,
        endereco,
        numero,
        cep,
        bairro,
        uf,
        cidade,
        complemento,
        stusuario,
        dtcadastro
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        'ati',
        CURRENT_DATE
      )
      RETURNING cpf, nmusuario, email, stusuario
    `,
    [
      sanitizeCpf(input.cpf),
      legacyPasswordHash(input.password),
      input.name,
      input.rg,
      input.birthDate,
      input.sex,
      input.email,
      input.phone,
      input.mobile,
      input.address,
      input.number,
      input.cep,
      input.district,
      input.uf,
      input.cityId,
      input.complement,
    ],
  );

  const row = result.rows[0];

  return row ? mapUser(row) : null;
}

export async function updatePublicUserProfile(
  cpf: string,
  input: PublicUserProfileInput,
) {
  const pool = getIngressoDbPool();

  await pool.query(
    `
      UPDATE usuario
      SET nmusuario = $2,
          email = $3,
          rg = $4,
          dtnascimento = $5,
          sexo = $6,
          telefone = $7,
          celular = $8,
          endereco = $9,
          numero = $10,
          cep = $11,
          bairro = $12,
          uf = $13,
          cidade = $14,
          complemento = $15
      WHERE cpf = $1
    `,
    [
      sanitizeCpf(cpf),
      input.name,
      input.email,
      input.rg,
      input.birthDate,
      input.sex,
      input.phone,
      input.mobile,
      input.address,
      input.number,
      input.cep,
      input.district,
      input.uf,
      input.cityId,
      input.complement,
    ],
  );

  return getActivePublicUserProfileByCpf(cpf);
}

export async function checkPublicUserPassword(cpf: string, password: string) {
  const pool = getIngressoDbPool();
  const result = await pool.query<{ cpf: string }>(
    `
      SELECT cpf
      FROM usuario
      WHERE cpf = $1
        AND senha = $2
      LIMIT 1
    `,
    [sanitizeCpf(cpf), legacyPasswordHash(password)],
  );

  return result.rows.length > 0;
}

export async function updatePublicUserPassword(cpf: string, password: string) {
  const pool = getIngressoDbPool();

  await pool.query(
    `
      UPDATE usuario
      SET senha = $2
      WHERE cpf = $1
    `,
    [sanitizeCpf(cpf), legacyPasswordHash(password)],
  );
}
