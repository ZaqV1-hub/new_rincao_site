export type Phase7ParityStatus =
  | "implemented"
  | "validated"
  | "pending"
  | "deprecated";

export type Phase7ParityAction = {
  legacyController: string;
  legacyAction: string;
  capability: string;
  status: Phase7ParityStatus;
  nextSurface: string | null;
  evidence: string;
};

export type Phase7ParityDomain = {
  domain: string;
  criticality: "critical" | "high" | "medium";
  actions: Phase7ParityAction[];
};

export type Phase7ParitySummary = {
  total: number;
  implemented: number;
  validated: number;
  pending: number;
  deprecated: number;
  completionPercent: number;
  writeCutoverReady: boolean;
};

export type Phase7ParityReport = {
  phase: 7;
  title: string;
  generatedAt: string;
  summary: Phase7ParitySummary;
  domains: Phase7ParityDomain[];
  blockers: Phase7ParityAction[];
};

const implementedBilheteriaVoucherActions: Phase7ParityAction[] = [
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "ajaxValidaVoucherAction",
    capability: "Validar voucher individual",
    status: "implemented",
    nextSurface: "/api/ops/vouchers/validate",
    evidence: "apps/web/src/app/api/ops/vouchers/validate/route.ts",
  },
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "ajaxDesvalidaVouchersSelecionadosAction",
    capability: "Desvalidar vouchers em lote",
    status: "implemented",
    nextSurface: "/api/ops/vouchers/unvalidate",
    evidence: "apps/web/src/app/api/ops/vouchers/unvalidate/route.ts",
  },
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "ajaxValidaVouchersSelecionadosAction",
    capability: "Validar vouchers selecionados",
    status: "implemented",
    nextSurface: "/api/ops/vouchers/validate",
    evidence: "apps/web/src/app/api/ops/vouchers/validate/route.ts",
  },
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "ajaxGetVouchersDadosAction",
    capability: "Consultar vouchers por compra, escola e agenda",
    status: "implemented",
    nextSurface: "/api/ops/audit-logs e console /operacoes",
    evidence: "apps/web/src/lib/ops-voucher-validation.ts",
  },
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "imprimirAction",
    capability: "Impressao operacional de ingresso/voucher",
    status: "implemented",
    nextSurface: "PDF/voucher export",
    evidence: "apps/web/src/lib/voucher-pdf.tsx",
  },
];

const pendingBilheteriaActions: Phase7ParityAction[] = [
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "ajaxGetIndicadoresAction",
    capability: "Indicadores de bilheteria",
    status: "implemented",
    nextSurface: "/painel/bilheteria/indicadores",
    evidence: "apps/web/src/app/painel/(protected)/bilheteria/indicadores/page.tsx",
  },
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "pagarReservaAction",
    capability: "Pagamento de reserva no painel",
    status: "implemented",
    nextSurface: "/painel/bilheteria/reservas/[purchaseId]",
    evidence:
      "apps/web/src/app/painel/(protected)/bilheteria/reservas/[purchaseId]/page.tsx",
  },
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "historicoVendasAction",
    capability: "Tela de historico de vendas",
    status: "implemented",
    nextSurface: "/painel/bilheteria/historico",
    evidence:
      "apps/web/src/app/painel/(protected)/bilheteria/historico/page.tsx",
  },
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "imprimirQrAction",
    capability: "Impressao de QR individual",
    status: "implemented",
    nextSurface: "/painel/bilheteria/vouchers/[voucherId]/imprimir",
    evidence:
      "apps/web/src/app/painel/(protected)/bilheteria/vouchers/[voucherId]/imprimir/page.tsx",
  },
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "ajaxEnviarWhatsappIngressoAction",
    capability: "Envio de ingresso por WhatsApp",
    status: "implemented",
    nextSurface: "/painel/bilheteria/historico/[purchaseId] e /painel/bilheteria/reservas/[purchaseId]",
    evidence:
      "apps/web/src/app/api/painel/bilheteria/vouchers/[voucherId]/whatsapp/route.ts",
  },
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "historicoVendasDadosAction",
    capability: "Consulta detalhada do historico de vendas",
    status: "implemented",
    nextSurface: "/painel/bilheteria/historico/[purchaseId]",
    evidence:
      "apps/web/src/app/painel/(protected)/bilheteria/historico/[purchaseId]/page.tsx",
  },
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "historicoVendasSalvarAction",
    capability: "Edicao auditavel de venda historica",
    status: "implemented",
    nextSurface: "/painel/bilheteria/historico/[purchaseId]/editar",
    evidence:
      "Tela dedicada cobre compra, pagamentos, status de voucher, modalidade de desconto, avisos pos-save do backend e estados Conferido/Divergente alinhados ao Zend.",
  },
  {
    legacyController: "BilheteriaController.php",
    legacyAction: "historicoVendasExcluirAction",
    capability: "Cancelamento/exclusao auditavel no historico",
    status: "implemented",
    nextSurface: "/painel/bilheteria/historico/[purchaseId]",
    evidence: "apps/web/src/app/api/ops/purchases/cancel/route.ts",
  },
  {
    legacyController: "_CompraReservaController.php",
    legacyAction: "consultaPagseguroAction",
    capability: "Consulta manual PagSeguro/Cielo de reserva",
    status: "implemented",
    nextSurface: "/painel/bilheteria/reservas/[purchaseId]",
    evidence:
      "apps/web/src/app/api/painel/bilheteria/purchases/[purchaseId]/gateway-status/route.ts",
  },
];

const domains: Phase7ParityDomain[] = [
  {
    domain: "Bilheteria, vouchers e vendas",
    criticality: "critical",
    actions: [
      ...implementedBilheteriaVoucherActions,
      {
        legacyController: "BilheteriaController.php",
        legacyAction: "ajaxPagarCompraAction",
        capability: "Confirmar pagamento de compra",
        status: "implemented",
        nextSurface: "/api/ops/purchases/update",
        evidence: "apps/web/src/app/api/ops/purchases/update/route.ts",
      },
      {
        legacyController: "BilheteriaController.php",
        legacyAction: "finalizarAction",
        capability: "Venda presencial de bilheteria",
        status: "implemented",
        nextSurface: "/api/ops/box-office/sales",
        evidence: "apps/web/src/app/api/ops/box-office/sales/route.ts",
      },
      ...pendingBilheteriaActions,
    ],
  },
  {
    domain: "Caixa, sangria e fechamento",
    criticality: "critical",
    actions: [
      {
        legacyController: "BilheteriaController.php",
        legacyAction: "fundoCaixaAction",
        capability: "Fundo de caixa",
        status: "implemented",
        nextSurface: "/api/ops/cash-movements",
        evidence: "apps/web/src/app/api/ops/cash-movements/route.ts",
      },
      {
        legacyController: "BilheteriaController.php",
        legacyAction: "ajaxAtualizarMovimentacaoCaixaAction",
        capability: "Editar fundo/sangria",
        status: "implemented",
        nextSurface: "/api/ops/cash-movements",
        evidence: "apps/web/src/lib/ops-cash-management.ts",
      },
      {
        legacyController: "BilheteriaController.php",
        legacyAction: "ajaxExcluirMovimentacaoCaixaAction",
        capability: "Excluir fundo/sangria com auditoria",
        status: "implemented",
        nextSurface: "/api/ops/cash-movements",
        evidence: "apps/web/src/lib/ops-cash-management.ts",
      },
      {
        legacyController: "BilheteriaController.php",
        legacyAction: "fechamentoCaixaAction",
        capability: "Resumo e fechamento de caixa",
        status: "implemented",
        nextSurface: "/api/ops/cash-closures",
        evidence: "apps/web/src/app/api/ops/cash-closures/route.ts",
      },
      {
        legacyController: "BilheteriaController.php",
        legacyAction: "cronFecharDiaAction",
        capability: "Fechamento automatico diario",
        status: "implemented",
        nextSurface: "/api/ops/jobs/daily-run",
        evidence: "apps/web/src/app/api/ops/jobs/daily-run/route.ts",
      },
    ],
  },
  {
    domain: "Referencias operacionais",
    criticality: "high",
    actions: [
      {
        legacyController: "DescontosController.php",
        legacyAction: "salvarAction",
        capability: "CRUD de descontos",
        status: "implemented",
        nextSurface: "/api/ops/reference-data",
        evidence: "apps/web/src/lib/ops-reference-data.ts",
      },
      {
        legacyController: "CortesiasController.php",
        legacyAction: "salvarAction",
        capability: "CRUD de autorizadores de cortesia",
        status: "implemented",
        nextSurface: "/api/ops/reference-data",
        evidence: "apps/web/src/lib/ops-reference-data.ts",
      },
    ],
  },
  {
    domain: "Cadastros administrativos",
    criticality: "high",
    actions: [
      {
        legacyController: "AgendaController.php",
        legacyAction: "index/adicionar/remover/ajaxCheckDate",
        capability: "Gerenciamento de agenda por calendario mensal e detalhe do dia",
        status: "implemented",
        nextSurface: "/painel/agenda",
        evidence: "apps/web/src/app/painel/(protected)/agenda/page.tsx",
      },
      {
        legacyController: "ParametroController.php",
        legacyAction: "index",
        capability: "Manutencao de parametros do sistema",
        status: "implemented",
        nextSurface: "/api/ops/admin/parameters",
        evidence: "apps/web/src/lib/ops-admin-parameters.ts",
      },
      {
        legacyController: "InformacaoController.php",
        legacyAction: "index/adicionar/editar/remover",
        capability: "CRUD administrativo de informacoes",
        status: "implemented",
        nextSurface: "/api/ops/admin/master-data/information",
        evidence: "apps/web/src/lib/ops-admin-master-data.ts",
      },
      {
        legacyController: "TabelaPrecoController.php",
        legacyAction: "index/adicionar/editar/remover",
        capability: "CRUD administrativo de tabelas de preco",
        status: "implemented",
        nextSurface: "/api/ops/admin/master-data/price-tables",
        evidence: "apps/web/src/lib/ops-admin-master-data.ts",
      },
      {
        legacyController: "CategoriasController.php",
        legacyAction: "index/novo/editar/salvar/excluir",
        capability: "CRUD administrativo de tipos de desconto",
        status: "implemented",
        nextSurface: "/api/ops/reference-data e console /painel",
        evidence:
          "apps/web/src/lib/ops-reference-data.ts e apps/web/src/components/operations-console.tsx",
      },
      {
        legacyController: "CategoriaSocioController.php",
        legacyAction: "index/adicionar/editar/remover",
        capability: "CRUD administrativo de categorias de socio",
        status: "implemented",
        nextSurface: "/api/ops/admin/master-data/membership-categories",
        evidence: "apps/web/src/lib/ops-admin-master-data.ts",
      },
      {
        legacyController: "ConvenioController.php",
        legacyAction: "index/adicionar/editar/remover",
        capability: "CRUD administrativo de convenios",
        status: "implemented",
        nextSurface: "/api/ops/admin/master-data/agreements",
        evidence: "apps/web/src/lib/ops-admin-master-data.ts",
      },
      {
        legacyController: "ClientesController.php",
        legacyAction: "index/adicionar/editar/remover",
        capability: "CRUD administrativo basico de clientes",
        status: "implemented",
        nextSurface: "/api/ops/admin/master-data/clients",
        evidence: "apps/web/src/lib/ops-admin-master-data.ts",
      },
      {
        legacyController: "EscolaController.php",
        legacyAction: "index/adicionar/editar/detalhe/remover",
        capability: "CRUD administrativo basico de escolas",
        status: "implemented",
        nextSurface: "/api/ops/admin/master-data/schools",
        evidence: "apps/web/src/lib/ops-admin-master-data.ts",
      },
      {
        legacyController: "UsuarioController.php",
        legacyAction: "index/adicionar/editar/detalhe/remover",
        capability: "CRUD administrativo de usuarios internos",
        status: "implemented",
        nextSurface: "/api/ops/admin/master-data/internal-users",
        evidence: "apps/web/src/lib/ops-admin-master-data.ts",
      },
      {
        legacyController: "UsuarioSiteController.php",
        legacyAction: "index/detalhe",
        capability: "Consulta e manutencao de usuarios do site",
        status: "implemented",
        nextSurface: "/api/ops/admin/master-data/site-users",
        evidence: "apps/web/src/lib/ops-admin-master-data.ts",
      },
      {
        legacyController: "SocioController.php",
        legacyAction: "index/adicionar/editar/detalhe/remover",
        capability: "CRUD administrativo de socios",
        status: "implemented",
        nextSurface: "/api/ops/admin/master-data/members",
        evidence: "apps/web/src/lib/ops-admin-master-data.ts",
      },
      {
        legacyController: "CompraConvenioController.php",
        legacyAction: "index/exportaXls/sidebar",
        capability: "Relatorios e consolidacao de compra convenio",
        status: "implemented",
        nextSurface: "/api/ops/admin/reports/agreement-purchases e console /operacoes",
        evidence: "apps/web/src/lib/ops-agreement-purchases.ts",
      },
      {
        legacyController: "ConvenioController.php",
        legacyAction:
          "listaConveniado/adicionarConveniado/editarConveniado/detalheConveniado/removerConveniado/importarConveniado/importar/downloadLog",
        capability: "Conveniados e importacao de conveniados",
        status: "implemented",
        nextSurface:
          "/api/ops/admin/agreements/[agreementId]/members e /imports/*, console /operacoes",
        evidence: "apps/web/src/lib/ops-agreement-members.ts",
      },
      {
        legacyController: "ConvenioController.php",
        legacyAction: "cancelarImportacaoAction",
        capability: "Cancelamento de importacao staged",
        status: "deprecated",
        nextSurface: null,
        evidence:
          "Importacao no BFF e stateless; preview nao persiste staging e dispensa cancelamento.",
      },
    ],
  },
  {
    domain: "Clientes, escolas, passeios e relatorios",
    criticality: "high",
    actions: [
      {
        legacyController: "ClientesController.php",
        legacyAction:
          "tipos/autocomplete/toggleStatus/turmaSalvar/turmaRemover/turmaToggleStatus/periodoSalvar/periodoRemover/periodoToggleStatus",
        capability: "Tipos, autocomplete, status, turmas e periodos de clientes",
        status: "implemented",
        nextSurface:
          "/api/ops/admin/client-types, /api/ops/admin/clients/autocomplete, /api/ops/admin/clients/[clientId]/status, /api/ops/admin/clients/[clientId]/classes",
        evidence:
          "apps/web/src/lib/ops-client-education.ts e apps/web/src/components/operations-console.tsx",
      },
      {
        legacyController: "ClientesController.php",
        legacyAction: "passeios/relatorios/links/alunos",
        capability: "Passeios, links, alunos e relatorios de clientes",
        status: "implemented",
        nextSurface:
          "/painel/clientes/passeios, /painel/clientes/passeios/[agendaId]/alunos e /api/ops/admin/clients/trips*",
        evidence:
          "Lista, vinculo, links de compra, edicao de faixas, desvinculo, detalhe de alunos/educadores e relatorios CSV/PDF entregues no modulo de passeios.",
      },
      {
        legacyController: "EscolaController.php",
        legacyAction: "adicionarDatapasseio/removerDatapasseio/editarStatus/passeio/relatorios",
        capability: "Datas de passeio, cancelamento e relatorios escolares",
        status: "implemented",
        nextSurface:
          "/painel/clientes/escolas/passeios e /api/ops/admin/schools/[schoolId]/trips*",
        evidence:
          "CRUD de datas/status por escola, detalhe com alunos/educadores e relatorios JSON/CSV/PDF entregues no novo modulo escolar.",
      },
    ],
  },
];

export function getPhase7ParityDomains() {
  return domains.map((domain) => ({
    ...domain,
    actions: domain.actions.map((action) => ({ ...action })),
  }));
}

export function summarizePhase7Parity(
  parityDomains: Phase7ParityDomain[],
): Phase7ParitySummary {
  const actions = parityDomains.flatMap((domain) => domain.actions);
  const implemented = actions.filter(
    (action) => action.status === "implemented",
  ).length;
  const validated = actions.filter((action) => action.status === "validated").length;
  const pending = actions.filter((action) => action.status === "pending").length;
  const deprecated = actions.filter(
    (action) => action.status === "deprecated",
  ).length;
  const total = actions.length;
  const closed = implemented + validated + deprecated;

  return {
    total,
    implemented,
    validated,
    pending,
    deprecated,
    completionPercent: total > 0 ? Math.round((closed / total) * 100) : 100,
    writeCutoverReady: pending === 0,
  };
}

export function getPhase7ParityReport(date = new Date()): Phase7ParityReport {
  const parityDomains = getPhase7ParityDomains();
  const summary = summarizePhase7Parity(parityDomains);

  return {
    phase: 7,
    title: "Operacao Interna e Painel",
    generatedAt: date.toISOString(),
    summary,
    domains: parityDomains,
    blockers: parityDomains
      .flatMap((domain) => domain.actions)
      .filter((action) => action.status === "pending"),
  };
}
