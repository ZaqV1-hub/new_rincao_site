import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PainelCompraContestacoes, ChargebackCaseList, ChargebackAutomationSummary } from "./painel-compra-contestacoes";

const caseFixture = {
  id: 71,
  purchaseId: 32,
  idCase: "30000000000000000001",
  idChargeback: "71000000000000000001",
  establishmentNumber: "72000001",
  deadline: "2026-11-11",
  reason: "Motivo Cielo",
  amount: "20.00",
  status: "exception",
  issue: "Vínculo ambíguo",
  lastSyncedAt: "2026-11-03T15:00:00Z",
  updatedAt: "2026-11-03T15:00:00Z",
  hasDossier: true,
  submittedAt: null,
  remoteStatus: "PENDING",
  resultMessage: "Defesa recebida para análise",
} as const;

it("shows a pending exception, the Cielo deadline, and the stored dossier action", () => {
  const html = renderToStaticMarkup(<ChargebackCaseList items={[caseFixture]} />);

  expect(html).toContain("30000000000000000001");
  expect(html).toContain("71000000000000000001");
  expect(html).toContain("Exceção");
  expect(html).toContain("Vínculo ambíguo");
  expect(html).toContain("Defesa recebida para análise");
  expect(html).toContain("11/11/2026");
  expect(html).toContain("03/11/2026, 12:00");
  expect(html).toContain('href="/api/painel/contestacoes/71/dossie"');
  expect(html).not.toContain("<button");
});

it("shows a remotely treated case separately from a submitted defense", () => {
  const html = renderToStaticMarkup(<ChargebackCaseList items={[{
    ...caseFixture,
    status: "remote_done",
    issue: null,
    remoteStatus: "DONE",
    resultMessage: null,
  }]} />);

  expect(html).toContain("Tratada na Cielo");
  expect(html).not.toContain("Defesa apresentada");
});

it("links the purchase detail to the automatic monitoring overview", () => {
  const html = renderToStaticMarkup(<PainelCompraContestacoes purchaseId={32} />);

  expect(html).toContain('href="/painel/compras/contestacoes"');
  expect(html).toContain('id="contestacoes"');
});

it("distinguishes intentionally disabled automation from missing or stale runs", () => {
  for (const [status, message] of [["disabled", "Automação desligada"], ["missing", "ainda não há execução"], ["stale", "mais de 15 minutos"], ["failed", "falha ou pendência"]] as const) {
    const html = renderToStaticMarkup(<ChargebackAutomationSummary automation={{ enabled: status !== "disabled", status, lastRunAt: null, lastSuccessAt: null }} />);
    expect(html).toContain(message);
    expect(html).not.toContain("Automação ativa");
  }
});
