import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PainelBilheteriaWorkstation } from "@/components/painel-bilheteria-workstation";

describe("PainelBilheteriaWorkstation", () => {
  it("renders the main validation and lookup areas", () => {
    const html = renderToStaticMarkup(
      React.createElement(PainelBilheteriaWorkstation, {
        actorName: "Operador Teste",
        actorCpf: "52998224725",
      }),
    );

    expect(html).toContain("Validação via Voucher");
    expect(html).toContain("Validação via Dados do Cliente");
    expect(html).toContain("Consultar Ingresso");
    expect(html).toContain("Voucher");
    expect(html).toContain("RG ou CPF");
    expect(html).toContain("Inserir ID ou numero do ingresso");
    expect(html).toContain("Imprimir QR-Code");
    expect(html).toContain("Enviar no WhatsApp");
    expect(html).not.toContain("/painel/bilheteria?consult=1");
  });
});
