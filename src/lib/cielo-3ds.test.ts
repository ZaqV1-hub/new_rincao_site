import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCielo3dsTokenData,
  isCielo3dsConfigured,
  resetCielo3dsTokenCacheForTests,
} from "@/lib/cielo-3ds";

const originalEnv = process.env;

describe("cielo-3ds", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      INGRESSO_CIELO_3DS_CLIENT_ID: "client-id",
      INGRESSO_CIELO_3DS_CLIENT_SECRET: "client-secret",
      INGRESSO_CIELO_3DS_ESTABLISHMENT_CODE: "2899426197",
      INGRESSO_CIELO_3DS_MERCHANT_NAME: "RINCAO POUSADA E LAZER LTDA",
      INGRESSO_CIELO_3DS_MCC: "5811",
      INGRESSO_CIELO_3DS_TOKEN_ENDPOINT: "https://mpi.example.test/token",
      INGRESSO_CIELO_3DS_ENVIRONMENT: "PRD",
      INGRESSO_CIELO_3DS_DEBUG: "1",
      INGRESSO_CIELO_3DS_TIMEOUT_MS: "12000",
    };
    resetCielo3dsTokenCacheForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetCielo3dsTokenCacheForTests();
    vi.unstubAllGlobals();
  });

  it("detects missing native configuration", () => {
    delete process.env.INGRESSO_CIELO_3DS_CLIENT_ID;

    expect(isCielo3dsConfigured()).toBe(false);
  });

  it("requests a 3ds token with basic auth and establishment payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        access_token: "token-123",
        token_type: "Bearer",
        expires_in: 900,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCielo3dsTokenData()).resolves.toMatchObject({
      accessToken: "token-123",
      tokenType: "Bearer",
      environment: "PRD",
      debug: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://mpi.example.test/token",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          authorization: `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          EstablishmentCode: "2899426197",
          MerchantName: "RINCAO POUSADA E LAZER LTDA",
          MCC: "5811",
        }),
      }),
    );
  });

  it("reuses the cached token before the guard window", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        access_token: "cached-token",
        token_type: "Bearer",
        expires_in: 900,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await getCielo3dsTokenData();
    const second = await getCielo3dsTokenData();

    expect(first.accessToken).toBe("cached-token");
    expect(second.accessToken).toBe("cached-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
