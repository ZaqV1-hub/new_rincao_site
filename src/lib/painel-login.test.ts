import { describe, expect, it } from "vitest";
import {
  mapPainelLoginErrorCode,
  resolvePainelRecaptchaSiteKey,
  sanitizePainelRedirect,
  shouldBypassPainelRecaptcha,
} from "@/lib/painel-login";

describe("painel-login helpers", () => {
  it("keeps only local painel redirects", () => {
    expect(sanitizePainelRedirect("/painel/bilheteria")).toBe("/painel/bilheteria");
    expect(sanitizePainelRedirect("/agenda")).toBe("/painel");
    expect(sanitizePainelRedirect("//evil.example.com")).toBe("/painel");
  });

  it("maps known login errors to user-facing messages", () => {
    expect(mapPainelLoginErrorCode("invalid_credentials")).toBe(
      "CPF ou senha invalidos.",
    );
    expect(mapPainelLoginErrorCode("recaptcha_rejected")).toBe(
      "Ocorreu um erro ao validar o Recaptcha, tente novamente.",
    );
    expect(mapPainelLoginErrorCode("unknown")).toBeNull();
  });

  it("allows local recaptcha bypass outside production", () => {
    expect(shouldBypassPainelRecaptcha("http://127.0.0.1:3000/api/painel/session")).toBe(
      true,
    );
    expect(shouldBypassPainelRecaptcha("http://localhost:3000/api/painel/session")).toBe(
      true,
    );
    expect(shouldBypassPainelRecaptcha("https://www.estancia.local/api/painel/session")).toBe(
      false,
    );
  });

  it("disables painel recaptcha on local hosts even when a site key exists", () => {
    expect(
      resolvePainelRecaptchaSiteKey(
        "site-key",
        "http://127.0.0.1:3000/painel/login",
      ),
    ).toBeNull();
    expect(
      resolvePainelRecaptchaSiteKey(
        "site-key",
        "http://localhost:3000/painel/login",
      ),
    ).toBeNull();
    expect(
      resolvePainelRecaptchaSiteKey(
        "site-key",
        "https://www.estancia.local/painel/login",
      ),
    ).toBe("site-key");
  });
});
