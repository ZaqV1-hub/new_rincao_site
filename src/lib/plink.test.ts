import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildClientTripPurchasePath,
  createClientTripPlink,
  normalizeClientTripTypeSlug,
  readClientTripPlink,
} from "@/lib/plink";

describe("plink", () => {
  const previousSecret = process.env.INGRESSO_PLINK_SECRET;

  afterEach(() => {
    if (previousSecret == null) {
      delete process.env.INGRESSO_PLINK_SECRET;
    } else {
      process.env.INGRESSO_PLINK_SECRET = previousSecret;
    }
    vi.unstubAllEnvs();
  });

  it("normalizes legacy trip type aliases", () => {
    expect(normalizeClientTripTypeSlug("Escola")).toBe("escola");
    expect(normalizeClientTripTypeSlug("Melhor Idade")).toBe("melhoridade");
    expect(normalizeClientTripTypeSlug("Grupos Mistos")).toBe(
      "confraternizacao",
    );
  });

  it("creates and reads a deterministic plink payload", () => {
    vi.stubEnv("INGRESSO_PLINK_SECRET", "plink-secret");

    const token = createClientTripPlink({
      idagenda: 10,
      idcliente: 20,
      tipo: "escola",
    });

    expect(readClientTripPlink(token)).toEqual({
      idagenda: 10,
      idcliente: 20,
      tipo: "escola",
      ver: 1,
    });
  });

  it("rejects tampered tokens", () => {
    vi.stubEnv("INGRESSO_PLINK_SECRET", "plink-secret");

    const token = createClientTripPlink({
      idagenda: 10,
      idcliente: 20,
      tipo: "escola",
    });

    expect(readClientTripPlink(`${token}x`)).toBeNull();
  });

  it("builds the new school purchase path for school trips", () => {
    vi.stubEnv("INGRESSO_PLINK_SECRET", "plink-secret");

    const path = buildClientTripPurchasePath({
      idagenda: 10,
      idcliente: 20,
      tipo: "Escola",
    });

    expect(path).toMatch(/^\/ingresso\/escola\?plink=/);
    if (!path) {
      throw new Error("expected school purchase path");
    }
    expect(readClientTripPlink(path.split("plink=")[1] ?? "")).toEqual({
      idagenda: 10,
      idcliente: 20,
      tipo: "escola",
      ver: 1,
    });
  });

  it("returns null when the trip type has no public purchase flow yet", () => {
    expect(
      buildClientTripPurchasePath({
        idagenda: 10,
        idcliente: 20,
        tipo: "Igreja",
      }),
    ).toBeNull();
  });
});
