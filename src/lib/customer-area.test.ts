import { describe, expect, it } from "vitest";
import {
  mapCustomerLoginErrorCode,
  sanitizeCustomerRedirect,
} from "@/lib/customer-area";

describe("customer-area helpers", () => {
  it("keeps only local redirects", () => {
    expect(sanitizeCustomerRedirect("/agenda")).toBe("/agenda");
    expect(sanitizeCustomerRedirect("https://example.com")).toBe("/minha-conta");
    expect(sanitizeCustomerRedirect("//evil.example.com")).toBe("/minha-conta");
  });

  it("maps known login errors to user-facing messages", () => {
    expect(mapCustomerLoginErrorCode("invalid_credentials")).toBe(
      "CPF ou senha invalidos.",
    );
    expect(mapCustomerLoginErrorCode("auth_unavailable")).toBe(
      "Nao foi possivel autenticar agora.",
    );
    expect(mapCustomerLoginErrorCode("unknown_code")).toBeNull();
  });
});
