import { getIngressoSistemaDbDialect, getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { hashPasswordForLegacyUser } from "@/lib/password-hashing";
import { ensureSiteAccountOverridesTable } from "@/lib/site-account-overrides";
import {
  createPublicUser as createRegularUser,
  getActivePublicUserByCpf,
} from "@/lib/user-repository";
import { decodeGuestClaim } from "@/lib/lumi-guest-token.mjs";

type Registration = Parameters<typeof createRegularUser>[0];

const GUEST_CLAIM_KEY_ENV = "RINCAO_GUEST_CLAIM_KEY";

export class GuestClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuestClaimError";
  }
}

function readClaim(token: unknown, cpf: string) {
  return decodeGuestClaim(
    token,
    cpf,
    process.env[GUEST_CLAIM_KEY_ENV],
  );
}

function normalizePhone(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "").slice(-11);
}

function matchesClaimPhone(
  claimPhone: string,
  phone: string | null | undefined,
  mobile: string | null | undefined,
) {
  const expected = normalizePhone(claimPhone);
  const submitted = normalizePhone(mobile) || normalizePhone(phone);

  return Boolean(expected && submitted && submitted === expected);
}

function phoneMatchSql() {
  const digitsExpression =
    getIngressoSistemaDbDialect() === "mysql"
      ? "REGEXP_REPLACE(COALESCE(NULLIF(celular, ''), telefone, ''), '[^0-9]', '')"
      : "REGEXP_REPLACE(COALESCE(NULLIF(celular, ''), telefone, ''), '[^0-9]', '', 'g')";

  return `RIGHT(${digitsExpression}, 11) = RIGHT($PHONE, 11)`;
}

function guestAccountGuard(cpfParameter: number, phoneParameter: number, orderParameter: number) {
  return `
    cpf = $${cpfParameter}
    AND idpapel IS NULL
    AND stusuario = 'ati'
    AND NULLIF(TRIM(senha), '') IS NULL
    AND NULLIF(TRIM(email), '') IS NULL
    AND ${phoneMatchSql().replace("$PHONE", `$${phoneParameter}`)}
    AND NOT EXISTS (
      SELECT 1 FROM usuario_site_conta site_account
      WHERE site_account.cpf = usuario.cpf
    )
    AND EXISTS (
      SELECT 1
      FROM compra c
      WHERE c.cpf = usuario.cpf
        AND c.idcompra = $${orderParameter}
        AND c.stcompra = 'conc'
        AND c.origem_checkout = 'lumi'
    )
  `;
}

function emailNotInUseGuard(emailParameter: number) {
  return `
    AND NOT EXISTS (
      SELECT 1 FROM usuario other_user
      WHERE lower(trim(other_user.email)) = lower(trim($${emailParameter}))
        AND other_user.cpf <> usuario.cpf
        AND other_user.idpapel IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM usuario_site_conta other_site_account
      WHERE lower(trim(other_site_account.email)) = lower(trim($${emailParameter}))
        AND other_site_account.cpf <> usuario.cpf
    )
  `;
}

export async function canClaimGuest(
  cpf: string,
  token: unknown,
  phone: string | null,
  mobile: string | null,
) {
  const claim = readClaim(token, cpf);

  if (!claim || !matchesClaimPhone(claim.phone, phone, mobile)) {
    return false;
  }

  await ensureSiteAccountOverridesTable();
  const result = await getIngressoSistemaDbPool().query<{ cpf: string }>(
    `SELECT cpf FROM usuario WHERE ${guestAccountGuard(1, 2, 3)} LIMIT 1`,
    [cpf, claim.phone, claim.order_id],
  );

  return result.rows.length === 1;
}

export async function createPublicUserWithGuestClaim(
  input: Registration,
  token?: unknown,
) {
  if (!token) {
    return createRegularUser(input);
  }

  const claim = readClaim(token, input.cpf);

  if (!claim || !matchesClaimPhone(claim.phone, input.phone, input.mobile)) {
    throw new GuestClaimError("guest_claim_invalid");
  }

  await ensureSiteAccountOverridesTable();

  const result = await getIngressoSistemaDbPool().query<{ cpf: string }>(
    `
      UPDATE usuario SET
        senha = $2,
        nmusuario = $3,
        rg = $4,
        dtnascimento = $5,
        sexo = $6,
        email = $7,
        telefone = $8,
        celular = $9,
        endereco = $10,
        numero = $11,
        cep = $12,
        bairro = $13,
        uf = $14,
        cidade = $15,
        complemento = $16
      WHERE ${guestAccountGuard(1, 17, 18)}
        ${emailNotInUseGuard(7)}
      RETURNING cpf
    `,
    [
      input.cpf,
      hashPasswordForLegacyUser(input.password),
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
      claim.phone,
      claim.order_id,
    ],
  );

  if (result.rowCount !== 1 && result.rows.length !== 1) {
    throw new GuestClaimError("guest_account_cannot_be_replaced");
  }

  const user = await getActivePublicUserByCpf(input.cpf);

  if (!user) {
    throw new GuestClaimError("guest_account_unavailable");
  }

  return user;
}
