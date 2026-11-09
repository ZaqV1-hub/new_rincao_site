import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PainelContestacoesPage } from "./painel-contestacoes-page";

it("describes automatic processing and links back to purchases", () => {
  const html = renderToStaticMarkup(<PainelContestacoesPage />);

  expect(html).toContain("Contestação");
  expect(html).toContain("automaticamente");
  expect(html).toContain('href="/painel/compras"');
});
