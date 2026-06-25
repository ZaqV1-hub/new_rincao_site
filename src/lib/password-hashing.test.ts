import { describe, expect, it } from "vitest";
import {
  hashLegacyMd5Password,
  hashPasswordForLegacyUser,
  verifyLegacyMd5Password,
} from "@/lib/password-hashing";

describe("password-hashing", () => {
  it("keeps legacy md5 compatibility centralized", () => {
    const hash = hashLegacyMd5Password("password");

    expect(hash).toEqual({
      algorithm: "legacy-md5",
      value: "5f4dcc3b5aa765d61d8327deb882cf99",
    });
    expect(hashPasswordForLegacyUser("password")).toBe(hash.value);
    expect(verifyLegacyMd5Password("password", hash.value)).toBe(true);
  });
});
