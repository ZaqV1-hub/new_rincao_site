import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PainelConvenioMemberDetailPage } from "@/components/painel-convenio-member-detail-page";

describe("PainelConvenioMemberDetailPage", () => {
  it("renderiza os blocos do detalhe do conveniado e do usuario", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelConvenioMemberDetailPage, {
        detail: {
          agreementId: 7,
          agreementName: "Convenio Alfa",
          cpf: "12345678901",
          cpfLabel: "123.456.789-01",
          userName: "Joao Silva",
          dailyPurchaseLimit: 2,
          startDate: "01/05/2026",
          endDate: "31/05/2026",
          statusCode: "ati",
          statusLabel: "Ativo",
          createdAt: "06/05/2026",
          userDocument: "12345678901",
          userRg: "1234567",
          birthDate: "02/01/1990",
          genderLabel: "Masculino",
          email: "joao@example.test",
          phone: "1133334444",
          mobile: "11999999999",
          address: "Rua A, 10",
          zipCode: "01000-000",
          district: "Centro",
          cityLabel: "Sao Paulo - SP",
          complement: "Casa",
          userStatusLabel: "Ativo",
          userCreatedAt: "01/01/2025",
          lastLoginLabel: "07/05/2026 as 10:30:00",
        },
      }),
    );

    expect(html).toContain("123.456.789-01");
    expect(html).toContain("Qtd. compra por dia");
    expect(html).toContain("Joao Silva");
    expect(html).toContain("Ultimo Login");
  });
});
