import { describe, expect, it } from "vitest";
import { buildRootCutoverUpstream } from "@/lib/root-cutover-routing";

const options = {
  nextOrigin: "http://127.0.0.1:3001",
};

describe("buildRootCutoverUpstream", () => {
  it("routes every ingresso path to Next instead of the legacy origin", () => {
    for (const path of [
      "/ingresso",
      "/ingresso/painel/bilheteria",
      "/ingresso/agendar/index/did/MTQ=",
      "/ingresso/comprar/ajax-finaliza-compra",
      "/ingresso/meus-dados/vouchers",
      "/ingresso/cadastro/ajax-cidades-html",
      "/ingresso/pagamento/status",
      "/ingresso/rota-desconhecida",
    ]) {
      expect(buildRootCutoverUpstream(new URL(path, "https://example.test"), options)).toEqual({
        origin: options.nextOrigin,
        url: `${options.nextOrigin}${path}`,
        legacy: false,
      });
    }
  });

  it("keeps query strings while routing ingresso paths to Next", () => {
    expect(
      buildRootCutoverUpstream(
        new URL("/ingresso/painel/clientes?status=ativo", "https://example.test"),
        options,
      ),
    ).toEqual({
      origin: options.nextOrigin,
      url: `${options.nextOrigin}/ingresso/painel/clientes?status=ativo`,
      legacy: false,
    });
  });
});
