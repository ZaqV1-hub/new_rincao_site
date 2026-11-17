import { createDecipheriv } from "node:crypto";

const TOKEN_PURPOSE = "lumi-rincao-guest-account-v1";
const MAX_TOKEN_LENGTH = 2048;
const MAX_CLAIM_LIFETIME_SECONDS = 3605;

export function decodeGuestClaim(token, cpf, keyBase64, now = Date.now()) {
  try {
    if (
      typeof token !== "string" ||
      !token.startsWith("v1.") ||
      token.length > MAX_TOKEN_LENGTH
    ) {
      return null;
    }

    const raw = Buffer.from(token.slice(3), "base64url");
    const key = Buffer.from(keyBase64 || "", "base64");

    if (key.length !== 32 || raw.length < 29) {
      return null;
    }

    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(TOKEN_PURPOSE));
    decipher.setAuthTag(raw.subarray(-16));

    const data = JSON.parse(
      Buffer.concat([
        decipher.update(raw.subarray(12, -16)),
        decipher.final(),
      ]).toString("utf8"),
    );
    const currentEpoch = Math.floor(now / 1000);

    if (
      data.purpose !== "guest-account" ||
      data.cpf !== cpf ||
      !Number.isInteger(data.exp) ||
      data.exp <= currentEpoch ||
      data.exp > currentEpoch + MAX_CLAIM_LIFETIME_SECONDS ||
      !/^\d{11}$/.test(data.cpf) ||
      !/^\d{10,15}$/.test(data.phone) ||
      !/^\d+$/.test(data.order_id)
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}
