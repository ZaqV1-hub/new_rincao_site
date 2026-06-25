import { describe, expect, it, vi } from "vitest";
import {
  getPainelLoginFeedback,
  navigateAfterPainelLogin,
} from "@/components/painel-login-page";

describe("PainelLoginPage helpers", () => {
  it("descreve feedback explicito durante envio e redirecionamento", () => {
    expect(getPainelLoginFeedback("submitting")).toMatchObject({
      buttonLabel: "Validando acesso...",
      statusTitle: "Entrando no painel",
    });
    expect(getPainelLoginFeedback("redirecting")).toMatchObject({
      buttonLabel: "Abrindo painel...",
      statusTitle: "Login concluido",
    });
  });

  it("usa o redirect padrao sem refresh extra", () => {
    const router = {
      replace: vi.fn(),
      refresh: vi.fn(),
    };

    navigateAfterPainelLogin(router, "/painel", "/painel/administrativo");

    expect(router.replace).toHaveBeenCalledWith("/painel/administrativo");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("preserva um redirect explicito do request", () => {
    const router = {
      replace: vi.fn(),
      refresh: vi.fn(),
    };

    navigateAfterPainelLogin(router, "/painel/compras", "/painel");

    expect(router.replace).toHaveBeenCalledWith("/painel/compras");
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
