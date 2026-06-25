import { describe, expect, it } from "vitest";
import { resolveLegacyIngressoRoute } from "@/lib/legacy-public-routes";

describe("resolveLegacyIngressoRoute", () => {
  it("redirects the ingresso landing page to the public agenda", () => {
    expect(resolveLegacyIngressoRoute()).toEqual({
      destination: "/agenda",
      kind: "redirect",
      status: 308,
    });
  });

  it("redirects legacy public calendar URLs to the public agenda", () => {
    expect(resolveLegacyIngressoRoute(["calendario-site"])).toMatchObject({
      destination: "/agenda",
      kind: "redirect",
    });
  });

  it("redirects the legacy login entrypoint to the native customer login page", () => {
    expect(resolveLegacyIngressoRoute(["login"])).toMatchObject({
      destination: "/login",
      kind: "redirect",
    });
  });

  it("preserves the legacy school entrypoint instead of collapsing it into the registration flow", () => {
    expect(resolveLegacyIngressoRoute(["escola"])).toMatchObject({
      destination: "/ingresso/escola",
      kind: "redirect",
    });
  });

  it("redirects the legacy educator entrypoint to the new public educator flow", () => {
    expect(resolveLegacyIngressoRoute(["educador"])).toMatchObject({
      destination: "/ingresso/educador",
      kind: "redirect",
    });
  });

  it("redirects legacy exclusive school trip links to the new school purchase page", () => {
    expect(
      resolveLegacyIngressoRoute(["cliente", "escola", "plink-token"]),
    ).toMatchObject({
      destination: "/ingresso/escola?plink=plink-token",
      kind: "redirect",
    });
  });

  it("redirects legacy educator access links with permalink to the shared public report flow", () => {
    expect(
      resolveLegacyIngressoRoute(["educador", "acesso", "plink", "plink-token"]),
    ).toMatchObject({
      destination: "/ingresso/escola/acesso/plink/plink-token",
      kind: "redirect",
    });
  });

  it("redirects legacy encoded event URLs to the new purchase page", () => {
    expect(
      resolveLegacyIngressoRoute(["index", "index", "did", "MTQvMDYvMjAyNg=="]),
    ).toMatchObject({
      destination: "/comprar/MTQvMDYvMjAyNg==",
      kind: "redirect",
    });
  });

  it("redirects legacy agenda and purchase URLs to the native public flows", () => {
    expect(
      resolveLegacyIngressoRoute(["agendar", "index", "did", "MTQ="]),
    ).toMatchObject({
      destination: "/agendar/MTQ=",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["comprar", "index", "did", "MTQ="]),
    ).toMatchObject({
      destination: "/comprar/MTQ=",
      kind: "redirect",
    });
  });

  it("redirects legacy customer account URLs to native account surfaces", () => {
    expect(resolveLegacyIngressoRoute(["meus-dados"])).toMatchObject({
      destination: "/minha-conta",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["meus-dados", "editar"])).toMatchObject({
      destination: "/minha-conta/editar",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["meus-dados", "vouchers"])).toMatchObject({
      destination: "/meus-ingressos",
      kind: "redirect",
    });
  });

  it("redirects legacy registration URLs to native registration and password reset", () => {
    expect(resolveLegacyIngressoRoute(["cadastro"])).toMatchObject({
      destination: "/cadastro",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["login", "esqueci"])).toMatchObject({
      destination: "/login/esqueci",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["login", "trocar-senha", "ticket", "abc"]),
    ).toMatchObject({
      destination: "/login/trocar-senha/ticket/abc",
      kind: "redirect",
    });
  });

  it("redirects legacy panel URLs to native panel surfaces", () => {
    expect(resolveLegacyIngressoRoute(["painel"])).toMatchObject({
      destination: "/painel",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["painel", "agenda"])).toMatchObject({
      destination: "/painel/agenda",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["painel", "bilheteria"])).toMatchObject({
      destination: "/painel/bilheteria",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["painel", "clientes", "passeios"])).toMatchObject({
      destination: "/painel/clientes/passeios",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["painel", "escola"])).toMatchObject({
      destination: "/painel/clientes/escolas/passeios",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "bilheteria", "venda"]),
    ).toMatchObject({
      destination: "/painel/bilheteria/vendas",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "bilheteria", "finalizar"]),
    ).toMatchObject({
      destination: "/painel/bilheteria/finalizar",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "bilheteria", "pagar-reserva", "44"]),
    ).toMatchObject({
      destination: "/painel/bilheteria/pagar-reserva/44",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "bilheteria", "fundo-caixa"]),
    ).toMatchObject({
      destination: "/painel/bilheteria/fundo-caixa",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "bilheteria", "fechamento-caixa"]),
    ).toMatchObject({
      destination: "/painel/bilheteria/fechamento-caixa",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["painel", "operacao"])).toMatchObject({
      destination: "/painel/bilheteria",
      kind: "redirect",
    });
  });

  it("redirects legacy compra-reserva aliases to compras surfaces", () => {
    expect(resolveLegacyIngressoRoute(["painel", "compra-reserva"])).toMatchObject({
      destination: "/painel/compras",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "compra-reserva", "voucher"]),
    ).toMatchObject({
      destination: "/painel/compras/vouchers",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute([
        "painel",
        "compra-reserva",
        "detalhe",
        "id",
        "MTIz",
      ]),
    ).toMatchObject({
      destination: "/painel/compras/123",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute([
        "painel",
        "compra-reserva",
        "consulta-pagseguro",
        "id",
        "MTIz",
      ]),
    ).toMatchObject({
      destination: "/painel/compras/123/consulta-pagamento",
      kind: "redirect",
    });
  });

  it("redirects legacy convenio aliases to dedicated convenio surfaces", () => {
    expect(resolveLegacyIngressoRoute(["painel", "convenio"])).toMatchObject({
      destination: "/painel/convenios",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "convenio", "adicionar"]),
    ).toMatchObject({
      destination: "/painel/convenios/adicionar",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "convenio", "detalhe", "id", "MTIz"]),
    ).toMatchObject({
      destination: "/painel/convenios/123",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "convenio", "editar", "id", "MTIz"]),
    ).toMatchObject({
      destination: "/painel/convenios/123/editar",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute([
        "painel",
        "convenio",
        "lista-conveniado",
        "id",
        "MTIz",
      ]),
    ).toMatchObject({
      destination: "/painel/convenios/123/conveniados",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute([
        "painel",
        "convenio",
        "importar-conveniado",
        "id",
        "MTIz",
      ]),
    ).toMatchObject({
      destination: "/painel/convenios/123/importacao",
      kind: "redirect",
    });
  });

  it("redirects legacy compra-convenio aliases to dedicated purchase report surface", () => {
    expect(
      resolveLegacyIngressoRoute(["painel", "compra-convenio"]),
    ).toMatchObject({
      destination: "/painel/compra-convenio",
      kind: "redirect",
    });
  });

  it("redirects legacy administrative controllers to dedicated native panel modules", () => {
    expect(resolveLegacyIngressoRoute(["painel", "usuario"])).toMatchObject({
      destination: "/painel/usuario",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["painel", "usuario-site"])).toMatchObject({
      destination: "/painel/usuario-site",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["painel", "tabela-preco"])).toMatchObject({
      destination: "/painel/tabela-preco",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["painel", "informacao"])).toMatchObject({
      destination: "/painel/informacao",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["painel", "parametro"])).toMatchObject({
      destination: "/painel/parametro",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["painel", "categoria-socio"])).toMatchObject({
      destination: "/painel/categoria-socio",
      kind: "redirect",
    });
    expect(resolveLegacyIngressoRoute(["painel", "socio"])).toMatchObject({
      destination: "/painel/socio",
      kind: "redirect",
    });
  });

  it("redirects legacy usuario actions to dedicated native user surfaces", () => {
    const encodedCpf = Buffer.from("12345678901").toString("base64");

    expect(
      resolveLegacyIngressoRoute(["painel", "usuario", "adicionar"]),
    ).toMatchObject({
      destination: "/painel/usuario/adicionar",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "usuario", "detalhe", "cpf", encodedCpf]),
    ).toMatchObject({
      destination: "/painel/usuario/detalhe/12345678901",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "usuario", "editar", "cpf", encodedCpf]),
    ).toMatchObject({
      destination: "/painel/usuario/editar/12345678901",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "usuario", "minha-conta"]),
    ).toMatchObject({
      destination: "/painel/usuario/minha-conta",
      kind: "redirect",
    });
  });

  it("redirects legacy tabela-preco actions to dedicated native surfaces", () => {
    const encodedId = Buffer.from("7").toString("base64");

    expect(
      resolveLegacyIngressoRoute(["painel", "tabela-preco", "adicionar"]),
    ).toMatchObject({
      destination: "/painel/tabela-preco/adicionar",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "tabela-preco", "detalhe", "id", encodedId]),
    ).toMatchObject({
      destination: "/painel/tabela-preco/7",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "tabela-preco", "editar", "id", encodedId]),
    ).toMatchObject({
      destination: "/painel/tabela-preco/7/editar",
      kind: "redirect",
    });
  });

  it("redirects legacy informacao actions to dedicated native surfaces", () => {
    const encodedId = Buffer.from("9").toString("base64");

    expect(
      resolveLegacyIngressoRoute(["painel", "informacao", "adicionar"]),
    ).toMatchObject({
      destination: "/painel/informacao/adicionar",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute([
        "painel",
        "informacao",
        "detalhe",
        "idinformacao",
        encodedId,
      ]),
    ).toMatchObject({
      destination: "/painel/informacao/9",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "informacao", "editar", "id", encodedId]),
    ).toMatchObject({
      destination: "/painel/informacao/9/editar",
      kind: "redirect",
    });
  });

  it("redirects legacy categoria-socio actions to dedicated native surfaces", () => {
    const encodedId = Buffer.from("11").toString("base64");

    expect(
      resolveLegacyIngressoRoute(["painel", "categoria-socio", "adicionar"]),
    ).toMatchObject({
      destination: "/painel/categoria-socio/adicionar",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "categoria-socio", "detalhe", "id", encodedId]),
    ).toMatchObject({
      destination: "/painel/categoria-socio/11",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "categoria-socio", "editar", "id", encodedId]),
    ).toMatchObject({
      destination: "/painel/categoria-socio/11/editar",
      kind: "redirect",
    });
  });

  it("redirects legacy socio actions to dedicated native surfaces", () => {
    const encodedCpf = Buffer.from("12345678901").toString("base64");

    expect(
      resolveLegacyIngressoRoute(["painel", "socio", "adicionar"]),
    ).toMatchObject({
      destination: "/painel/socio/adicionar",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "socio", "detalhe", "cpf", encodedCpf]),
    ).toMatchObject({
      destination: "/painel/socio/12345678901",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "socio", "editar", "cpf", encodedCpf]),
    ).toMatchObject({
      destination: "/painel/socio/12345678901/editar",
      kind: "redirect",
    });
  });

  it("redirects legacy usuario-site actions to dedicated native surfaces", () => {
    const encodedCpf = Buffer.from("12345678901").toString("base64");

    expect(
      resolveLegacyIngressoRoute(["painel", "usuario-site", "detalhe", "cpf", encodedCpf]),
    ).toMatchObject({
      destination: "/painel/usuario-site/12345678901",
      kind: "redirect",
    });
  });

  it("redirects legacy cortesias aliases to dedicated courtesy surfaces", () => {
    expect(resolveLegacyIngressoRoute(["painel", "cortesias"])).toMatchObject({
      destination: "/painel/cortesias",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "cortesias", "novo"]),
    ).toMatchObject({
      destination: "/painel/cortesias/novo",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "cortesias", "editar", "id", "123"]),
    ).toMatchObject({
      destination: "/painel/cortesias/123/editar",
      kind: "redirect",
    });
  });

  it("redirects legacy cod-indica aliases to dedicated cashback surfaces", () => {
    expect(resolveLegacyIngressoRoute(["painel", "cod-indica"])).toMatchObject({
      destination: "/painel/cod-indica",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "cod-indica", "cadastro"]),
    ).toMatchObject({
      destination: "/painel/cod-indica/cadastro",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute([
        "painel",
        "cod-indica",
        "detalhe",
        "id",
        Buffer.from("ABC123").toString("base64"),
      ]),
    ).toMatchObject({
      destination: "/painel/cod-indica/ABC123",
      kind: "redirect",
    });
    expect(
      resolveLegacyIngressoRoute(["painel", "cod-indica", "cadastro-mensagem"]),
    ).toMatchObject({
      destination: "/painel/cod-indica/mensagem",
      kind: "redirect",
    });
  });

  it("retires legacy ajax and cron endpoints without routing them to Zend", () => {
    expect(resolveLegacyIngressoRoute(["comprar", "ajax-finaliza-compra"])).toEqual({
      code: "endpoint_retired",
      kind: "retired",
      status: 410,
    });
    expect(resolveLegacyIngressoRoute(["cadastro", "ajax-cidades-html"])).toEqual({
      code: "endpoint_retired",
      kind: "retired",
      status: 410,
    });
    expect(resolveLegacyIngressoRoute(["cron", "index", "cielo-notificacao"])).toEqual({
      code: "endpoint_retired",
      kind: "retired",
      status: 410,
    });
  });

  it("does not collapse unsupported legacy ingresso paths into agenda", () => {
    expect(resolveLegacyIngressoRoute(["qualquer-coisa"])).toEqual({
      code: "ingresso_route_not_found",
      kind: "not_found",
      status: 404,
    });
  });
});
