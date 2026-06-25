import { decodeLegacyPurchaseId } from "@/lib/painel-compras";
import { decodeLegacyAgreementId } from "@/lib/painel-convenios";

export type IngressoLegacyRouteResolution =
  | {
      kind: "redirect";
      destination: string;
      status: 308;
    }
  | {
      kind: "retired";
      code: "endpoint_retired";
      status: 410;
    }
  | {
      kind: "not_found";
      code: "ingresso_route_not_found";
      status: 404;
    };

const endpointSegments = new Set([
  "ajax-carrinho-ingresso",
  "ajax-cidades-html",
  "ajax-cancelar-agendamento",
  "ajax-finaliza-compra",
  "ajax-prepara-gerar-voucher",
  "ajax-valida-codigo",
  "ajax-valida-compra",
  "calcular-valor-ajax",
  "carrega-info-ajax",
  "date-informations",
  "gerar-voucher",
  "informations",
  "sidebar",
  "valida-compra-ajax",
  "widget",
  "widget-escolhido",
]);

const panelEndpointSegments = new Set([
  "ajax-atualizar-movimentacao-caixa",
  "ajax-check-date",
  "ajax-enviar-whatsapp-ingresso",
  "ajax-excluir-movimentacao-caixa",
  "ajax-fechar-caixa",
  "ajax-get-indicadores",
  "ajax-get-vouchers-dados",
  "ajax-pagar-compra",
  "ajax-valida-voucher",
  "cron-fechar-dia",
  "exporta-csv",
  "exporta-pdf",
  "exporta-xls",
  "imprimir-qr",
]);

function redirect(destination: string): IngressoLegacyRouteResolution {
  return {
    destination,
    kind: "redirect",
    status: 308,
  };
}

function retired(): IngressoLegacyRouteResolution {
  return {
    code: "endpoint_retired",
    kind: "retired",
    status: 410,
  };
}

function notFound(): IngressoLegacyRouteResolution {
  return {
    code: "ingresso_route_not_found",
    kind: "not_found",
    status: 404,
  };
}

function encodeSegment(value: string) {
  return encodeURIComponent(value);
}

function decodeBase64Segment(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, "base64").toString("utf8").trim();
    return decoded || null;
  } catch {
    return null;
  }
}

function hasEndpointSegment(slug: string[]) {
  return slug.some(
    (segment) =>
      endpointSegments.has(segment) ||
      segment.startsWith("ajax-") ||
      segment.endsWith("-ajax"),
  );
}

function hasPanelEndpointSegment(slug: string[]) {
  return slug.some(
    (segment) =>
      panelEndpointSegments.has(segment) ||
      segment.startsWith("ajax-") ||
      segment.endsWith("-action"),
  );
}

function resolveEncodedPublicFlow(
  basePath: "/agendar" | "/comprar",
  slug: string[],
) {
  const [, second, third, fourth] = slug;

  if (second === "index" && third === "did" && fourth) {
    return redirect(`${basePath}/${fourth}`);
  }

  if (!second || second === "index") {
    return redirect("/agenda");
  }

  if (second === "did" && third) {
    return redirect(`${basePath}/${third}`);
  }

  if (second && !endpointSegments.has(second)) {
    return redirect(`${basePath}/${second}`);
  }

  return notFound();
}

function resolveCustomerAccount(slug: string[]) {
  const [, action] = slug;

  if (!action || action === "index") {
    return redirect("/minha-conta");
  }

  if (action === "editar") {
    return redirect("/minha-conta/editar");
  }

  if (action === "alterar-senha") {
    return redirect("/minha-conta/alterar-senha");
  }

  if (action === "vouchers") {
    return redirect("/meus-ingressos");
  }

  if (hasEndpointSegment(slug)) {
    return retired();
  }

  return notFound();
}

function resolveCadastro(slug: string[]) {
  const [, action] = slug;

  if (!action || action === "index") {
    return redirect("/cadastro");
  }

  if (action === "cpf" || hasEndpointSegment(slug)) {
    return retired();
  }

  return notFound();
}

function resolveLogin(slug: string[]) {
  const [, action, third, fourth] = slug;

  if (!action || action === "index") {
    return redirect("/login");
  }

  if (action === "logout") {
    return redirect("/login");
  }

  if (action === "esqueci") {
    return redirect("/login/esqueci");
  }

  if (action === "trocar-senha" && third === "ticket" && fourth) {
    return redirect(`/login/trocar-senha/ticket/${encodeSegment(fourth)}`);
  }

  return notFound();
}

function resolvePanelLogin(slug: string[]) {
  const [, , action, third, fourth] = slug;

  if (!action || action === "index") {
    return redirect("/painel/login");
  }

  if (action === "logout") {
    return redirect("/painel/login");
  }

  if (action === "esqueci") {
    return redirect("/painel/login/esqueci");
  }

  if (action === "trocar-senha" && third === "ticket" && fourth) {
    return redirect(`/painel/login/trocar-senha/ticket/${encodeSegment(fourth)}`);
  }

  return notFound();
}

function resolvePanel(slug: string[]) {
  const [, controller, action, third, fourth] = slug;

  if (!controller || controller === "index") {
    return redirect("/painel");
  }

  if (controller === "login") {
    return resolvePanelLogin(slug);
  }

  if (hasPanelEndpointSegment(slug)) {
    return retired();
  }

  if (controller === "agenda") {
    if (action === "adicionar") {
      return redirect("/painel/agenda/adicionar");
    }

    if (action === "editar" && third) {
      return redirect(`/painel/agenda/${encodeSegment(third)}/editar`);
    }

    if (action && /^\d{4}-\d{2}-\d{2}$/.test(action)) {
      return redirect(`/painel/agenda/${encodeSegment(action)}`);
    }

    return redirect("/painel/agenda");
  }

  if (controller === "bilheteria" || controller === "bilheteria-venda") {
    if (action === "venda") {
      return redirect("/painel/bilheteria/vendas");
    }

    if (action === "finalizar") {
      return redirect("/painel/bilheteria/finalizar");
    }

    if (action === "reservas" || action === "pagar-reserva") {
      return third
        ? redirect(`/painel/bilheteria/pagar-reserva/${encodeSegment(third)}`)
        : redirect("/painel/bilheteria");
    }

    if (action === "historico" || action === "historico-vendas") {
      return third
        ? redirect(`/painel/bilheteria/historico?purchase=${encodeSegment(third)}`)
        : redirect("/painel/bilheteria/historico");
    }

    if (action === "indicadores") {
      return redirect("/painel/bilheteria/indicadores");
    }

    if (action === "fechamento-caixa") {
      return redirect("/painel/bilheteria/fechamento-caixa");
    }

    if (action === "fechamento-caixa-historico") {
      return redirect("/painel/bilheteria/fechamento-caixa/historico");
    }

    if (action === "fechamento-caixa-edicoes") {
      return fourth
        ? redirect(
            `/painel/bilheteria/fechamento-caixa/edicoes?fechamento_id=${encodeSegment(fourth)}`,
          )
        : redirect("/painel/bilheteria/fechamento-caixa/edicoes");
    }

    if (action === "fundo-caixa") {
      return redirect("/painel/bilheteria/fundo-caixa");
    }

    return redirect("/painel/bilheteria");
  }

  if (controller === "operacao") {
    return redirect("/painel/bilheteria");
  }

  if (controller === "compra-reserva") {
    if (!action || action === "index") {
      return redirect("/painel/compras");
    }

    if (action === "voucher") {
      return redirect("/painel/compras/vouchers");
    }

    if (action === "detalhe" && third === "id" && fourth) {
      const purchaseId = decodeLegacyPurchaseId(fourth);
      return purchaseId
        ? redirect(`/painel/compras/${encodeSegment(String(purchaseId))}`)
        : redirect("/painel/compras");
    }

    if (action === "consulta-pagseguro" && third === "id" && fourth) {
      const purchaseId = decodeLegacyPurchaseId(fourth);
      return purchaseId
        ? redirect(
            `/painel/compras/${encodeSegment(String(purchaseId))}/consulta-pagamento`,
          )
        : redirect("/painel/compras");
    }

    return redirect("/painel/compras");
  }

  if (controller === "clientes") {
    if (action === "passeios") {
      if (third === "editar" && fourth) {
        return redirect(`/painel/clientes/passeios/${encodeSegment(fourth)}/editar`);
      }

      if (third === "alunos" && fourth) {
        return redirect(`/painel/clientes/passeios/${encodeSegment(fourth)}/alunos`);
      }

      return redirect("/painel/clientes/passeios");
    }

    return redirect("/painel/clientes");
  }

  if (controller === "escola") {
    return redirect("/painel/clientes/escolas/passeios");
  }

  if (controller === "convenio") {
    if (!action || action === "index") {
      return redirect("/painel/convenios");
    }

    if (action === "adicionar") {
      return redirect("/painel/convenios/adicionar");
    }

    if ((action === "detalhe" || action === "editar") && third === "id" && fourth) {
      const agreementId = decodeLegacyAgreementId(fourth);
      if (!agreementId) {
        return redirect("/painel/convenios");
      }

      return action === "editar"
        ? redirect(`/painel/convenios/${encodeSegment(String(agreementId))}/editar`)
        : redirect(`/painel/convenios/${encodeSegment(String(agreementId))}`);
    }

    if (
      (action === "lista-conveniado" || action === "importar-conveniado") &&
      third === "id" &&
      fourth
    ) {
      const agreementId = decodeLegacyAgreementId(fourth);
      if (!agreementId) {
        return redirect("/painel/convenios");
      }

      return action === "importar-conveniado"
        ? redirect(`/painel/convenios/${encodeSegment(String(agreementId))}/importacao`)
        : redirect(`/painel/convenios/${encodeSegment(String(agreementId))}/conveniados`);
    }

    return redirect("/painel/convenios");
  }

  if (controller === "compra-convenio") {
    return redirect("/painel/compra-convenio");
  }

  if (controller === "cod-indica") {
    if (!action || action === "index") {
      return redirect("/painel/cod-indica");
    }

    if (action === "cadastro") {
      return redirect("/painel/cod-indica/cadastro");
    }

    if (action === "cadastro-mensagem") {
      return redirect("/painel/cod-indica/mensagem");
    }

    if (action === "detalhe" && third === "id" && fourth) {
      const codigo = decodeBase64Segment(fourth);
      return codigo
        ? redirect(`/painel/cod-indica/${encodeSegment(codigo)}`)
        : redirect("/painel/cod-indica");
    }

    if (action === "editar" && third === "id" && fourth) {
      const codigo = decodeBase64Segment(fourth);
      return codigo
        ? redirect(`/painel/cod-indica/${encodeSegment(codigo)}/editar`)
        : redirect("/painel/cod-indica");
    }

    if (action === "relatorio" && third === "id" && fourth) {
      const codigo = decodeBase64Segment(fourth);
      return codigo
        ? redirect(`/painel/cod-indica/${encodeSegment(codigo)}/relatorio`)
        : redirect("/painel/cod-indica");
    }

    if (action === "detalhe-relatorio" && third === "id" && fourth) {
      const codigo = decodeBase64Segment(fourth);
      const reportStart = slug[5];
      const reportStartValue = slug[6];
      const reportEnd = slug[7];
      const reportEndValue = slug[8];

      if (!codigo) {
        return redirect("/painel/cod-indica");
      }

      const params = new URLSearchParams();
      if (reportStart === "dtini" && reportStartValue) {
        params.set("dtini", reportStartValue);
      }
      if (reportEnd === "dtfim" && reportEndValue) {
        params.set("dtfim", reportEndValue);
      }

      const suffix = params.size > 0 ? `?${params.toString()}` : "";
      return redirect(`/painel/cod-indica/${encodeSegment(codigo)}/relatorio${suffix}`);
    }

    return redirect("/painel/cod-indica");
  }

  if (controller === "usuario") {
    if (!action || action === "index") {
      return redirect("/painel/usuario");
    }

    if (action === "adicionar") {
      return redirect("/painel/usuario/adicionar");
    }

    if (action === "minha-conta" || action === "alterar-senha") {
      return redirect("/painel/usuario/minha-conta");
    }

    if ((action === "detalhe" || action === "editar") && third === "cpf" && fourth) {
      const cpf = decodeBase64Segment(fourth)?.replace(/\D+/g, "");

      if (!cpf || cpf.length !== 11) {
        return redirect("/painel/usuario");
      }

      return action === "editar"
        ? redirect(`/painel/usuario/editar/${encodeSegment(cpf)}`)
        : redirect(`/painel/usuario/detalhe/${encodeSegment(cpf)}`);
    }

    return redirect("/painel/usuario");
  }

  if (controller === "tabela-preco") {
    if (!action || action === "index") {
      return redirect("/painel/tabela-preco");
    }

    if (action === "adicionar") {
      return redirect("/painel/tabela-preco/adicionar");
    }

    if ((action === "detalhe" || action === "editar") && third === "id" && fourth) {
      const tableId = Number(decodeBase64Segment(fourth));

      if (!Number.isInteger(tableId) || tableId <= 0) {
        return redirect("/painel/tabela-preco");
      }

      return action === "editar"
        ? redirect(`/painel/tabela-preco/${encodeSegment(String(tableId))}/editar`)
        : redirect(`/painel/tabela-preco/${encodeSegment(String(tableId))}`);
    }

    return redirect("/painel/tabela-preco");
  }

  if (controller === "informacao") {
    if (!action || action === "index") {
      return redirect("/painel/informacao");
    }

    if (action === "adicionar") {
      return redirect("/painel/informacao/adicionar");
    }

    if ((action === "detalhe" || action === "editar") && third && fourth) {
      const paramKey = third;
      const infoId = Number(decodeBase64Segment(fourth));

      if (
        (paramKey !== "idinformacao" && paramKey !== "id") ||
        !Number.isInteger(infoId) ||
        infoId <= 0
      ) {
        return redirect("/painel/informacao");
      }

      return action === "editar"
        ? redirect(`/painel/informacao/${encodeSegment(String(infoId))}/editar`)
        : redirect(`/painel/informacao/${encodeSegment(String(infoId))}`);
    }

    return redirect("/painel/informacao");
  }

  if (controller === "categoria-socio") {
    if (!action || action === "index") {
      return redirect("/painel/categoria-socio");
    }

    if (action === "adicionar") {
      return redirect("/painel/categoria-socio/adicionar");
    }

    if ((action === "detalhe" || action === "editar") && third === "id" && fourth) {
      const categoryId = Number(decodeBase64Segment(fourth));

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return redirect("/painel/categoria-socio");
      }

      return action === "editar"
        ? redirect(`/painel/categoria-socio/${encodeSegment(String(categoryId))}/editar`)
        : redirect(`/painel/categoria-socio/${encodeSegment(String(categoryId))}`);
    }

    return redirect("/painel/categoria-socio");
  }

  if (controller === "socio") {
    if (!action || action === "index") {
      return redirect("/painel/socio");
    }

    if (action === "adicionar") {
      return redirect("/painel/socio/adicionar");
    }

    if ((action === "detalhe" || action === "editar") && third === "cpf" && fourth) {
      const cpf = decodeBase64Segment(fourth)?.replace(/\D+/g, "");

      if (!cpf || cpf.length !== 11) {
        return redirect("/painel/socio");
      }

      return action === "editar"
        ? redirect(`/painel/socio/${encodeSegment(cpf)}/editar`)
        : redirect(`/painel/socio/${encodeSegment(cpf)}`);
    }

    return redirect("/painel/socio");
  }

  if (controller === "usuario-site") {
    if (!action || action === "index") {
      return redirect("/painel/usuario-site");
    }

    if (action === "detalhe" && third === "cpf" && fourth) {
      const cpf = decodeBase64Segment(fourth)?.replace(/\D+/g, "");

      if (!cpf || cpf.length !== 11) {
        return redirect("/painel/usuario-site");
      }

      return redirect(`/painel/usuario-site/${encodeSegment(cpf)}`);
    }

    return redirect("/painel/usuario-site");
  }

  if (
    [
      "parametro",
      "usuario",
    ].includes(controller)
  ) {
    return redirect(`/painel/${encodeSegment(controller)}`);
  }

  if (controller === "descontos") {
    const currentAction = action ?? "index";
    if (currentAction === "index") {
      return redirect("/painel/descontos");
    }
    if (currentAction === "novo") {
      return redirect("/painel/descontos/novo");
    }
    if (currentAction === "editar" && third === "id" && fourth) {
      return redirect(`/painel/descontos/${encodeSegment(fourth)}/editar`);
    }
    return redirect("/painel/descontos");
  }

  if (controller === "categorias") {
    const currentAction = action ?? "index";
    if (currentAction === "index") {
      return redirect("/painel/categorias");
    }
    if (currentAction === "novo") {
      return redirect("/painel/categorias/novo");
    }
    if (currentAction === "editar" && third === "id" && fourth) {
      return redirect(`/painel/categorias/${encodeSegment(fourth)}/editar`);
    }
    return redirect("/painel/categorias");
  }

  if (controller === "cortesias") {
    const currentAction = action ?? "index";
    if (currentAction === "index") {
      return redirect("/painel/cortesias");
    }
    if (currentAction === "novo") {
      return redirect("/painel/cortesias/novo");
    }
    if (currentAction === "editar" && third === "id" && fourth) {
      return redirect(`/painel/cortesias/${encodeSegment(fourth)}/editar`);
    }
    return redirect("/painel/cortesias");
  }

  if (controller === "notallowed") {
    return redirect("/painel");
  }

  return notFound();
}

export function resolveLegacyIngressoRoute(slug: string[] = []): IngressoLegacyRouteResolution {
  if (slug.length === 0) {
    return redirect("/agenda");
  }

  if (hasEndpointSegment(slug)) {
    return retired();
  }

  if (slug[0] === "cron") {
    return retired();
  }

  if (slug[0] === "pagamento") {
    return retired();
  }

  if (slug[0] === "login") {
    return resolveLogin(slug);
  }

  if (slug[0] === "painel") {
    return resolvePanel(slug);
  }

  if (slug[0] === "agendar") {
    return resolveEncodedPublicFlow("/agendar", slug);
  }

  if (slug[0] === "comprar") {
    return resolveEncodedPublicFlow("/comprar", slug);
  }

  if (slug[0] === "meus-dados") {
    return resolveCustomerAccount(slug);
  }

  if (slug[0] === "cadastro") {
    return resolveCadastro(slug);
  }

  if (slug.length === 1) {
    if (slug[0] === "calendario-site" || slug[0] === "agendamento") {
      return redirect("/agenda");
    }

    if (slug[0] === "escola") {
      return redirect("/ingresso/escola");
    }

    if (slug[0] === "educador") {
      return redirect("/ingresso/educador");
    }
  }

  if (
    slug.length === 3 &&
    slug[0] === "cliente" &&
    slug[1] === "escola" &&
    slug[2]
  ) {
    return redirect(`/ingresso/escola?plink=${encodeSegment(slug[2])}`);
  }

  if (
    slug.length === 4 &&
    slug[0] === "educador" &&
    slug[1] === "acesso" &&
    slug[2] === "plink" &&
    slug[3]
  ) {
    return redirect(`/ingresso/escola/acesso/plink/${encodeSegment(slug[3])}`);
  }

  if (
    slug.length === 4 &&
    slug[0] === "index" &&
    slug[1] === "index" &&
    slug[2] === "did" &&
    slug[3]
  ) {
    return redirect(`/comprar/${slug[3]}`);
  }

  return notFound();
}
