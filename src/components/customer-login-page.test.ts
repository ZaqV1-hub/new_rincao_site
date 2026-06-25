import { describe, expect, it, vi } from "vitest";
import {
  getCustomerLoginFeedback,
  navigateAfterCustomerLogin,
} from "@/components/customer-login-page";

describe("CustomerLoginPage helpers", () => {
  it("descreve feedback explicito durante envio e redirecionamento", () => {
    expect(getCustomerLoginFeedback("submitting")).toMatchObject({
      buttonLabel: "Validando acesso...",
      statusTitle: "Entrando na sua conta",
    });
    expect(getCustomerLoginFeedback("redirecting")).toMatchObject({
      buttonLabel: "Abrindo area do cliente...",
      statusTitle: "Login concluido",
    });
  });

  it("navega para o redirect informado sem refresh extra", () => {
    const router = {
      replace: vi.fn(),
      refresh: vi.fn(),
    };

    navigateAfterCustomerLogin(router, "/meus-ingressos");

    expect(router.replace).toHaveBeenCalledWith("/meus-ingressos");
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
