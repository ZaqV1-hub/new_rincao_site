import { createCipheriv, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decodeGuestClaim } from "@/lib/lumi-guest-token.mjs";

const key = Buffer.alloc(32, 9);
const cpf = "52998224725";
const phone = "11999990000";
const now = 1_800_000_000_000;

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
    order_id: "190459",
    exp: Math.floor(now / 1000) + 3600,
    ...overrides,
  });
  const ciphertext = Buffer.concat([
    cipher.update(payload, "utf8"),
    cipher.final(),
  ]);
  const tokenBytes = Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);

  return `v1.${tokenBytes.toString("base64url")}`;
}

describe("decodeGuestClaim", () => {
  it("accepts an unexpired AES-GCM claim for its CPF", () => {
    expect(decodeGuestClaim(encodeClaim(), cpf, key.toString("base64"), now)).toEqual({
      purpose: "guest-account",
      cpf,
      phone,
      order_id: "190459",
      exp: Math.floor(now / 1000) + 3600,
    });
  });

  it("rejects expired claims, wrong CPF, wrong purpose, and an excessive lifetime", () => {
    const keyBase64 = key.toString("base64");

    expect(
      decodeGuestClaim(
        encodeClaim({ exp: Math.floor(now / 1000) }),
        cpf,
        keyBase64,
        now,
      ),
    ).toBeNull();
    expect(decodeGuestClaim(encodeClaim(), "11111111111", keyBase64, now)).toBeNull();
    expect(
      decodeGuestClaim(
        encodeClaim({ purpose: "payment" }),
        cpf,
        keyBase64,
        now,
      ),
    ).toBeNull();
    expect(
      decodeGuestClaim(
        encodeClaim({ exp: Math.floor(now / 1000) + 3606 }),
        cpf,
        keyBase64,
        now,
      ),
    ).toBeNull();
  });

  it("rejects an altered token, missing key, and invalid claim fields", () => {
    const validToken = encodeClaim();
    const bytes = Buffer.from(validToken.slice(3), "base64url");
    bytes[12] ^= 1;

    expect(
      decodeGuestClaim(
        `v1.${bytes.toString("base64url")}`,
        cpf,
        key.toString("base64"),
        now,
      ),
    ).toBeNull();
    expect(decodeGuestClaim(validToken, cpf, undefined, now)).toBeNull();
    expect(
      decodeGuestClaim(
        encodeClaim({ order_id: "190x" }),
        cpf,
        key.toString("base64"),
        now,
      ),
    ).toBeNull();
  });
});
