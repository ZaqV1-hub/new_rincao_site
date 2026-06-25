import { createHash } from "node:crypto";

export type PasswordHashAlgorithm = "legacy-md5" | "bcrypt";

export type PasswordHash = {
  algorithm: PasswordHashAlgorithm;
  value: string;
};

export function hashLegacyMd5Password(password: string): PasswordHash {
  return {
    algorithm: "legacy-md5",
    value: createHash("md5").update(password).digest("hex"),
  };
}

export function hashPasswordForLegacyUser(password: string) {
  return hashLegacyMd5Password(password).value;
}

export function verifyLegacyMd5Password(password: string, hash: string) {
  return hashPasswordForLegacyUser(password) === hash;
}
