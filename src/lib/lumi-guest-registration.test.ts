import { createCipheriv, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  regularCreate: vi.fn(),
  getActivePublicUserByCpf: vi.fn(),
  hashPassword: vi.fn(),
  ensureOverridesTable: vi.fn(),
  getDialect: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoSistemaDbPool: () => ({ query: mocks.query }),
  getIngressoSistemaDbDialect: mocks.getDialect,
}));
vi.mock("@/lib/password-hashing", () => ({
  hashPasswordForLegacyUser: mocks.hashPassword,
}));
vi.mock("@/lib/site-account-overrides", () => ({
  ensureSiteAccountOverridesTable: mocks.ensureOverridesTable,
}));
vi.mock("@/lib/user-repository", () => ({
  createPublicUser: mocks.regularCreate,
  getActivePublicUserByCpf: mocks.getActivePublicUserByCpf,
}));

import {
  canClaimGuest,
  createPublicUserWithGuestClaim,
  GuestClaimError,
} from "@/lib/lumi-guest-registration";

const key = Buffer.alloc(32, 7);
const cpf = "52998224725";
const phone = "11999990000";
const orderId = "190459";
const now = Date.now();
const registration = {
  cpf,
  password: "senha-forte-123",
  name: "Cliente Convidado",
  email: "cliente@example.com",
  rg: null,
  birthDate: "1990-01-01",
  sex: "f" as const,
  phone: "1155550000",
  mobile: "(11) 99999-0000",
  address: "Rua Teste",
  number: "10",
  cep: "04870425",
  district: "Jardim Teste",
  uf: "SP",
  cityId: 9668,
  complement: null,
};

function encodeClaim(
  overrides: Partial<{
    purpose: string;
    cpf: string;
    phone: string;
    order_id: string;
    exp: number;
  }> = {},
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("lumi-rincao-guest-account-v1"));
  const payload = JSON.stringify({
    purpose: "guest-account",
    cpf,
    phone,
    order_id: orderId,
    exp: Math.floor(now / 1000) + 3600,
    ...overrides,
  });
  const ciphertext = Buffer.concat([
    cipher.update(payload, "utf8"),
    cipher.final(),
  ]);

  return `v1.${Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64url")}`;
}

function expectEligibilityGuard(query: string) {
  expect(query).toContain("idpapel IS NULL");
  expect(query).toContain("stusuario = 'ati'");
  expect(query).toContain("NULLIF(TRIM(senha), '') IS NULL");
  expect(query).toContain("NULLIF(TRIM(email), '') IS NULL");
  expect(query).toContain("NOT EXISTS");
  expect(query).toContain("FROM usuario_site_conta");
  expect(query).toContain("c.stcompra = 'conc'");
  expect(query).toContain("c.origem_checkout = 'lumi'");
}

describe("Lumi guest registration claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RINCAO_GUEST_CLAIM_KEY = key.toString("base64");
    mocks.getDialect.mockReturnValue("postgres");
    mocks.hashPassword.mockReturnValue("stored-password-hash");
  });

  it("accepts only an eligible account with matching CPF, verified phone, and a paid Lumi purchase", async () => {
    mocks.query.mockResolvedValue({ rows: [{ cpf }], rowCount: 1 });

    await expect(
      canClaimGuest(cpf, encodeClaim(), registration.phone, registration.mobile),
    ).resolves.toBe(true);

    expect(mocks.ensureOverridesTable).toHaveBeenCalledOnce();
    expectEligibilityGuard(mocks.query.mock.calls[0][0]);
    expect(mocks.query.mock.calls[0][1]).toEqual([cpf, phone, orderId]);
  });

  it("rejects expired, tampered, wrong-CPF, and wrong-phone claims before querying", async () => {
    const expiredToken = encodeClaim({ exp: Math.floor(now / 1000) });
    const alteredBytes = Buffer.from(encodeClaim().slice(3), "base64url");
    alteredBytes[12] ^= 1;
    const alteredToken = `v1.${alteredBytes.toString("base64url")}`;

    await expect(
      canClaimGuest(cpf, expiredToken, registration.phone, registration.mobile),
    ).resolves.toBe(false);
    await expect(
      canClaimGuest(cpf, alteredToken, registration.phone, registration.mobile),
    ).resolves.toBe(false);
    await expect(
      canClaimGuest("11111111111", encodeClaim(), registration.phone, registration.mobile),
    ).resolves.toBe(false);
    await expect(
      canClaimGuest(cpf, encodeClaim(), registration.phone, "11911110000"),
    ).resolves.toBe(false);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("requires the submitted mobile to match when one is provided", async () => {
    await expect(
      canClaimGuest(cpf, encodeClaim(), registration.phone, "11911110000"),
    ).resolves.toBe(false);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each([
    "account already has a password",
    "account already has an email",
    "account has an administrative role",
    "account is inactive",
    "purchase is unpaid",
    "purchase is not from Lumi",
    "CPF is not tied to the claimed order",
    "CPF belongs to a site-account override",
  ])("rejects a database record that fails the eligibility guard: %s", async () => {
    mocks.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(
      canClaimGuest(cpf, encodeClaim(), registration.phone, registration.mobile),
    ).resolves.toBe(false);

    expectEligibilityGuard(mocks.query.mock.calls[0][0]);
  });

  it("updates only the same public CPF and keeps linked purchases and vouchers intact", async () => {
    const updatedUser = {
      cpf,
      cpfMasked: "529.***.***-25",
      name: registration.name,
      email: registration.email,
      status: "ati",
    };
    mocks.getDialect.mockReturnValue("mysql");
    mocks.query.mockResolvedValue({ rows: [], rowCount: 1 });
    mocks.getActivePublicUserByCpf.mockResolvedValue(updatedUser);

    await expect(
      createPublicUserWithGuestClaim(registration, encodeClaim()),
    ).resolves.toEqual(updatedUser);

    const [query, values] = mocks.query.mock.calls[0];
    expect(query).toContain("UPDATE usuario SET");
    expect(query).toContain("RETURNING cpf");
    expect(query).toContain("REGEXP_REPLACE(COALESCE(NULLIF(celular, ''), telefone, ''), '[^0-9]', '')");
    expectEligibilityGuard(query);
    expect(values[0]).toBe(cpf);
    expect(values[1]).toBe("stored-password-hash");
    expect(values[16]).toBe(phone);
    expect(values[17]).toBe(orderId);
    expect(query).not.toMatch(/UPDATE\s+(compra|voucher)/i);
    expect(query).toContain("lower(trim(other_user.email))");
    expect(query).toContain("lower(trim(other_site_account.email))");
    expect(mocks.getActivePublicUserByCpf).toHaveBeenCalledWith(cpf);
  });

  it("blocks the update if the account becomes ineligible before the guarded UPDATE", async () => {
    mocks.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(
      createPublicUserWithGuestClaim(registration, encodeClaim()),
    ).rejects.toBeInstanceOf(GuestClaimError);
    expect(mocks.getActivePublicUserByCpf).not.toHaveBeenCalled();
  });

  it("keeps the regular registration path unchanged when there is no claim", async () => {
    const createdUser = { cpf, name: registration.name };
    mocks.regularCreate.mockResolvedValue(createdUser);

    await expect(createPublicUserWithGuestClaim(registration)).resolves.toEqual(
      createdUser,
    );
    expect(mocks.regularCreate).toHaveBeenCalledWith(registration);
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
