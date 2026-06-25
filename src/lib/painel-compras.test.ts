import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPainelPurchaseListWhere,
  buildPainelPurchaseVoucherListWhere,
  decodeLegacyPurchaseId,
  getPainelPurchaseDetail,
  getPainelPurchaseGatewayConsult,
  listPainelPurchaseVouchers,
  listPainelPurchases,
  mapPainelPurchaseListExportRows,
  mapPainelPurchaseVoucherListExportRows,
  normalizePainelPurchaseListFilters,
  normalizePainelPurchaseVoucherListFilters,
  type PainelPurchaseListResult,
  type PainelPurchaseVoucherListResult,
} from "@/lib/painel-compras";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getNativeCieloCheckoutStatus: vi.fn(),
  isCieloEcommerceConfigured: vi.fn(),
  normalizePaymentReconciliationPayload: vi.fn(),
}));

vi.mock("@/lib/ingresso-db", () => ({
  getIngressoDbPool: () => ({
    query: mocks.query,
  }),
}));

vi.mock("@/lib/cielo-ecommerce", () => ({
  getNativeCieloCheckoutStatus: mocks.getNativeCieloCheckoutStatus,
  isCieloEcommerceConfigured: mocks.isCieloEcommerceConfigured,
}));

vi.mock("@/lib/payment-reconciliation", () => ({
  normalizePaymentReconciliationPayload: mocks.normalizePaymentReconciliationPayload,
}));

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isCieloEcommerceConfigured.mockReturnValue(true);
});

describe("normalizePainelPurchaseListFilters", () => {
  it("keeps legacy purchase filter fields in the compras contract shape", () => {
    const filters = normalizePainelPurchaseListFilters({
      "dtcompra[de]": "01/05/2026",
      "dtcompra[ate]": "07/05/2026",
      idcompra: "551",
      formapag: "pix",
    });

    expect(filters.purchaseId).toBe("551");
    expect(filters.dateFrom).toBe("01/05/2026");
    expect(filters.dateTo).toBe("07/05/2026");
    expect(filters.ticketPaymentMethod).toBe("pix");
  });
});

describe("normalizePainelPurchaseVoucherListFilters", () => {
  it("mantem o contrato legado de filtros da lista de vouchers", () => {
    const filters = normalizePainelPurchaseVoucherListFilters({
      idvoucher: "9001",
      "dtcompra[de]": "01/05/2026",
      "dtagenda[ate]": "09/05/2026",
      tpcompra: "parq",
      stusado: "s",
    });

    expect(filters).toEqual({
      voucherId: "9001",
      purchaseDateFrom: "01/05/2026",
      purchaseDateTo: null,
      usedDateFrom: null,
      usedDateTo: null,
      visitDateFrom: null,
      visitDateTo: "09/05/2026",
      voucherType: null,
      purchaseLocation: "parq",
      purchaseStatus: null,
      usedStatus: "s",
    });
  });
});

describe("buildPainelPurchaseListWhere", () => {
  it("builds the legacy corte clause with grouped bilheteria fallback and courtesy semantics", () => {
    const { sql } = buildPainelPurchaseListWhere({
      ticketPaymentMethod: "corte",
    });

    expect(normalizeSql(sql)).toBe(
      normalizeSql(`((compra.tpcompra = 'bilhe' AND (
        EXISTS (
          SELECT 1
          FROM compra_pagamentos cp
          WHERE cp.idcompra = compra.idcompra
            AND cp.forma_pagamento = 'corte'
        )
        OR (
          NOT EXISTS (
            SELECT 1
            FROM compra_pagamentos cp2
            WHERE cp2.idcompra = compra.idcompra
          )
          AND compra.formapag = 'corte'
        ) OR COALESCE(compra.vltotcompra,0) = 0
      )) OR (compra.tpcompra <> 'bilhe' AND compra.formapag = 'corte'))`),
    );
  });

  it("keeps the non-corte bilheteria clause grouped without the courtesy fallback", () => {
    const { sql } = buildPainelPurchaseListWhere({
      ticketPaymentMethod: "pix",
    });

    expect(normalizeSql(sql)).toBe(
      normalizeSql(`((compra.tpcompra = 'bilhe' AND (
        EXISTS (
          SELECT 1
          FROM compra_pagamentos cp
          WHERE cp.idcompra = compra.idcompra
            AND cp.forma_pagamento = 'pix'
        )
        OR (
          NOT EXISTS (
            SELECT 1
            FROM compra_pagamentos cp2
            WHERE cp2.idcompra = compra.idcompra
          )
          AND compra.formapag = 'pix'
        )
      )) OR (compra.tpcompra <> 'bilhe' AND compra.formapag = 'pix'))`),
    );
  });

  it("builds simple scalar, text, and date clauses for the broader purchase list contract", () => {
    const { sql } = buildPainelPurchaseListWhere({
      purchaseId: "551",
      type: "bilhe",
      purchaseStatus: "conc",
      gatewayPaymentMethod: "4",
      gatewayStatus: "3",
      cpf: "123.456.789-00",
      userName: "Maria Silva",
      dateFrom: "01/05/2026",
      dateTo: "07/05/2026",
    });

    expect(normalizeSql(sql)).toBe(
      normalizeSql(`compra.idcompra = 551
        AND compra.tpcompra = 'bilhe'
        AND compra.stcompra = 'conc'
        AND pagpagseguro.paymentmethodtype = '4'
        AND pagpagseguro.status = '3'
        AND usuario.cpf = '12345678900'
        AND usuario.nmusuario ILIKE '%Maria Silva%'
        AND compra.dtcompra >= TO_DATE('01/05/2026', 'DD/MM/YYYY')
        AND compra.dtcompra <= TO_DATE('07/05/2026', 'DD/MM/YYYY')`),
    );
  });

  it("skips the legacy bilheteria payment clause for the all-methods sentinel", () => {
    const { sql } = buildPainelPurchaseListWhere({
      ticketPaymentMethod: "-1",
    });

    expect(sql).toBe("");
  });
});

describe("buildPainelPurchaseVoucherListWhere", () => {
  it("aplica o mapeamento legado de onde/site-reserva-parque", () => {
    const { sql } = buildPainelPurchaseVoucherListWhere({
      voucherId: "9001",
      purchaseDateFrom: "01/05/2026",
      purchaseDateTo: null,
      usedDateFrom: null,
      usedDateTo: null,
      visitDateFrom: null,
      visitDateTo: null,
      voucherType: "escol",
      purchaseLocation: "parq",
      purchaseStatus: "conc",
      usedStatus: "n",
    });

    expect(normalizeSql(sql)).toBe(
      normalizeSql(`voucher.idvoucher = 9001
        AND c.dtcompra >= TO_DATE('01/05/2026', 'DD/MM/YYYY')
        AND voucher.tpvoucher = 'escol'
        AND c.tpcompra = 'bilhe'
        AND c.stcompra = 'conc'
        AND voucher.stusado = 'n'`),
    );
  });
});

describe("decodeLegacyPurchaseId", () => {
  it("decodes a legacy base64 purchase identifier", () => {
    expect(decodeLegacyPurchaseId("MTIz")).toBe(123);
  });
});

describe("mapPainelPurchaseListExportRows", () => {
  it("keeps the legacy list-principal column order for xls export", () => {
    const result: PainelPurchaseListResult = {
      items: [
        {
          purchaseId: 551,
          purchaseDate: "06/05/2026",
          paymentDate: "07/05/2026",
          paymentTime: "14:32:11",
          type: "ponli",
          typeLabel: "Compra",
          status: "conc",
          statusLabel: "Concluida",
          paymentMethodLabel: "PIX",
          paymentLabel: "Paga",
          cpf: "12345678901",
          userName: "DEV",
          totalValue: "80,00",
        },
      ],
      total: 1,
      page: 1,
      perPage: 30,
      totalPages: 1,
      filters: {
        purchaseId: null,
        type: null,
        purchaseStatus: null,
        ticketPaymentMethod: null,
        gatewayPaymentMethod: null,
        gatewayStatus: null,
        cpf: null,
        userName: null,
        dateFrom: null,
        dateTo: null,
      },
    };

    expect(mapPainelPurchaseListExportRows(result)).toEqual([
      [
        "ID",
        "Data",
        "Tipo",
        "Status",
        "Pagamento",
        "Data de pagamento",
        "Hora de pagamento",
        "Valor",
        "CPF",
        "Usuario",
      ],
      [
        "551",
        "06/05/2026",
        "Compra",
        "Concluida",
        "Paga",
        "07/05/2026",
        "14:32:11",
        "80,00",
        "12345678901",
        "DEV",
      ],
    ]);
  });
});

describe("mapPainelPurchaseVoucherListExportRows", () => {
  it("preserva as colunas legadas da exportacao de vouchers", () => {
    const result: PainelPurchaseVoucherListResult = {
      items: [
        {
          purchaseId: 551,
          voucherId: 9001,
          voucherNumber: "ABC-123",
          purchaseDate: "06/05/2026",
          visitDate: "08/05/2026",
          ticketTypeLabel: "Passaporte",
          name: "Cliente Teste",
          location: "ponli",
          locationLabel: "SITE",
          unitValue: "40,00",
          purchaseStatusLabel: "Concluida",
          usedLabel: "Nao",
          usedDate: null,
          usedTime: null,
          purchaseTypeLabel: "Compra",
        },
      ],
      total: 1,
      page: 1,
      perPage: 100,
      totalPages: 1,
      filters: {
        voucherId: null,
        purchaseDateFrom: null,
        purchaseDateTo: null,
        usedDateFrom: null,
        usedDateTo: null,
        visitDateFrom: null,
        visitDateTo: null,
        voucherType: null,
        purchaseLocation: null,
        purchaseStatus: null,
        usedStatus: null,
      },
      indicators: {
        qtdnormal_site: 1,
        vlnormal_site: "40,00",
        qtdinfantil_site: 0,
        vlinfantil_site: "0,00",
        qtdnormal_parque: 0,
        vlnormal_parque: "0,00",
        qtdinfantil_parque: 0,
        vlinfantil_parque: "0,00",
        qtdescola: 0,
        vlescola: "0,00",
        qtdadulto_reserva: 0,
        vladulto_reserva: "0,00",
        qtdinfantil_reserva: 0,
        vlinfantil_reserva: "0,00",
        qtespecial: 0,
        vlespecial: "0,00",
        qtdcortesia: 0,
        qtdisento: 0,
        totalCount: 1,
        totalValue: "40,00",
      },
    };

    expect(mapPainelPurchaseVoucherListExportRows(result)).toEqual([
      [
        "ID",
        "Voucher",
        "Data Visita",
        "Passaporte",
        "Tipo Compra",
        "Valor",
        "Usado",
        "Data de uso",
        "Hora de uso",
      ],
      ["9001", "ABC-123", "08/05/2026", "Passaporte", "Compra", "40,00", "Nao", "-", "-"],
    ]);
  });
});

describe("listPainelPurchases", () => {
  it("loads the main purchase list with legacy mapping and pagination", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("COUNT(*)::text AS total")) {
        return {
          rows: [{ total: "1" }],
        };
      }

      return {
        rowCount: 1,
        rows: [
          {
            idcompra: 551,
            dtcompra: "2026-05-06",
            tpcompra: "bilhe",
            stcompra: "conc",
            formapag: "pix",
            idpagseguro: null,
            paymentmethodtype: null,
            status: null,
            dtpagamento: "2026-05-07",
            hrpagamento: "10:15:00",
            cpf: "12345678901",
            nmusuario: "DEV",
            vltotcompra: "80.00",
          },
        ],
      };
    });

    await expect(
      listPainelPurchases({
        page: "2",
        perPage: "10",
        filters: {
          idcompra: "551",
          formapag: "pix",
        },
      }),
    ).resolves.toEqual({
      items: [
        {
          purchaseId: 551,
          purchaseDate: "06/05/2026",
          paymentDate: "07/05/2026",
          paymentTime: "10:15:00",
          type: "bilhe",
          typeLabel: "Bilheteria",
          status: "conc",
          statusLabel: "Concluida",
          paymentMethodLabel: "PIX",
          paymentLabel: "Bilheteria",
          cpf: "12345678901",
          userName: "DEV",
          totalValue: "80,00",
        },
      ],
      total: 1,
      page: 2,
      perPage: 10,
      totalPages: 1,
      filters: {
        purchaseId: "551",
        type: null,
        purchaseStatus: null,
        ticketPaymentMethod: "pix",
        gatewayPaymentMethod: null,
        gatewayStatus: null,
        cpf: null,
        userName: null,
        dateFrom: null,
        dateTo: null,
      },
    });

    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(String(mocks.query.mock.calls[0]?.[0])).toContain("LEFT JOIN LATERAL");
    expect(String(mocks.query.mock.calls[0]?.[0])).toContain("LIMIT 10");
    expect(String(mocks.query.mock.calls[0]?.[0])).toContain("OFFSET 10");
  });

  it("drops pagination clause when export requests all rows", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("COUNT(*)::text AS total")) {
        return {
          rows: [{ total: "2" }],
        };
      }

      return {
        rowCount: 2,
        rows: [],
      };
    });

    await listPainelPurchases({
      page: "1",
      filters: {},
      allRows: true,
    });

    expect(String(mocks.query.mock.calls[0]?.[0])).toContain("LEFT JOIN LATERAL");
    expect(String(mocks.query.mock.calls[0]?.[0])).not.toContain("LIMIT 5000");
    expect(String(mocks.query.mock.calls[0]?.[0])).not.toContain("OFFSET 0");
  });
});

describe("getPainelPurchaseDetail", () => {
  it("carrega o detalhe legado da compra com vouchers escolares", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM compra")) {
        return {
          rows: [
            {
              idcompra: 551,
              dtcompra: "2026-05-06",
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pgseg",
              vltotcompra: "80.00",
              dtpagamento: "2026-05-07",
              hrpagamento: "14:32:11",
              cpf: "12345678901",
              nmusuario: "DEV",
              codindica: null,
              idpagseguro: "pay-551",
              paymentmethodtype: "1",
              status: "3",
            },
          ],
        };
      }

      return {
        rows: [
          {
            idvoucher: 9001,
            numvoucher: "ABC-123",
            tpvoucher: "escol",
            idagenda: 2306,
            dtagenda: "2026-05-08",
            idescola: 77,
            nmescola: "Colegio Estancia",
            turma: "7A",
            periodo: "Manha",
            vlunicompra: "40.00",
            stusado: "n",
            dtuso: null,
            hruso: null,
          },
        ],
      };
    });

    await expect(getPainelPurchaseDetail(551)).resolves.toEqual({
      purchaseId: 551,
      purchaseDate: "06/05/2026",
      type: "ponli",
      typeLabel: "Compra",
      status: "conc",
      statusLabel: "Concluida",
      paymentLabel: "Cielo 3 - Paga",
      paymentMethodLabel: "Cartao de credito",
      paymentDate: "07/05/2026",
      paymentTime: "14:32:11",
      totalValue: "80,00",
      cpf: "12345678901",
      userName: "DEV",
      referralCode: null,
      gatewayPaymentId: "pay-551",
      gatewayStatusCode: "3",
      gatewayStatusLabel: "Paga",
      vouchers: [
        {
          voucherId: 9001,
          voucherNumber: "ABC-123",
          visitDate: "08/05/2026",
          voucherType: "escol",
          voucherTypeLabel: "Escolar",
          schoolName: "Colegio Estancia",
          className: "7A",
          periodName: "Manha",
          unitValue: "40,00",
          used: "n",
          usedLabel: "Nao",
          usedDate: null,
          usedTime: null,
          schoolTripHref: "/painel/clientes/passeios/2306/alunos",
        },
      ],
    });
  });
});

describe("getPainelPurchaseGatewayConsult", () => {
  it("retorna o resumo legado da consulta Cielo", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("LEFT JOIN usuario")) {
        return {
          rows: [
            {
              idcompra: 551,
              dtcompra: "2026-05-06",
              tpcompra: "ponli",
              stcompra: "conc",
              formapag: "pgseg",
              vltotcompra: "80.00",
              dtpagamento: "2026-05-07",
              hrpagamento: "14:32:11",
              cpf: "12345678901",
              nmusuario: "DEV",
              codindica: null,
              idpagseguro: "pay-551",
              paymentmethodtype: "1",
              status: "3",
            },
          ],
        };
      }

      return {
        rows: [
          {
            payment_id: "pay-551",
            reference: "551",
          },
        ],
      };
    });
    mocks.getNativeCieloCheckoutStatus.mockResolvedValue({
      status: "00",
      dados: {
        status: 3,
      },
    });
    mocks.normalizePaymentReconciliationPayload.mockReturnValue({
      status: 3,
      paymentMethodType: 1,
      grossAmount: "80.00",
      feeAmount: "0.00",
      netAmount: "80.00",
      date: new Date("2026-05-07T14:20:00.000Z"),
      lastEventDate: new Date("2026-05-07T14:32:11.000Z"),
      senderName: "Cliente Teste",
      senderEmail: "cliente@example.com",
      senderPhoneAreaCode: "51",
      senderPhoneNumber: "999999999",
    });

    await expect(getPainelPurchaseGatewayConsult(551)).resolves.toEqual({
      purchaseId: 551,
      found: true,
      message: "Consulta manual do gateway executada com sucesso.",
      statusCode: 3,
      statusLabel: "Paga",
      paymentMethodType: 1,
      paymentMethodLabel: "Cartao de credito",
      grossAmount: "80,00",
      feeAmount: "0,00",
      netAmount: "80,00",
      paymentDate: "2026-05-07T14:32:11.000Z",
      startedAt: "2026-05-07T14:20:00.000Z",
      finishedAt: "2026-05-07T14:32:11.000Z",
      senderName: "Cliente Teste",
      senderEmail: "cliente@example.com",
      senderPhone: "51 999999999",
    });
  });

  it("devolve estado de dados nao encontrados quando o gateway nao retorna a transacao", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("LEFT JOIN usuario")) {
        return {
          rows: [
            {
              idcompra: 551,
              dtcompra: "2026-05-06",
              tpcompra: "ponli",
              stcompra: "pend",
              formapag: "pgseg",
              vltotcompra: "80.00",
              dtpagamento: null,
              hrpagamento: null,
              cpf: "12345678901",
              nmusuario: "DEV",
              codindica: null,
              idpagseguro: null,
              paymentmethodtype: null,
              status: null,
            },
          ],
        };
      }

      return {
        rows: [],
      };
    });
    mocks.getNativeCieloCheckoutStatus.mockResolvedValue({
      status: "99",
      msgRetorno: "Nao localizado",
    });

    await expect(getPainelPurchaseGatewayConsult(551)).resolves.toEqual({
      purchaseId: 551,
      found: false,
      message: "Nao localizado",
      statusCode: null,
      statusLabel: null,
      paymentMethodType: null,
      paymentMethodLabel: null,
      grossAmount: "0,00",
      feeAmount: "0,00",
      netAmount: "0,00",
      paymentDate: null,
      startedAt: null,
      finishedAt: null,
      senderName: null,
      senderEmail: null,
      senderPhone: null,
    });
  });
});

describe("listPainelPurchaseVouchers", () => {
  it("carrega lista e indicadores legados de vouchers", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("COUNT(voucher.idvoucher)::text AS total")) {
        return { rows: [{ total: "1" }] };
      }

      if (sql.includes("SUM(CASE WHEN voucher.tpvoucher = 'norma'")) {
        return {
          rows: [
            {
              qtdnormal_site: "1",
              vlnormal_site: "40.00",
              qtdinfantil_site: "0",
              vlinfantil_site: "0.00",
              qtdnormal_parque: "0",
              vlnormal_parque: "0.00",
              qtdinfantil_parque: "0",
              vlinfantil_parque: "0.00",
              qtdescola: "0",
              vlescola: "0.00",
              qtdadulto_reserva: "0",
              vladulto_reserva: "0.00",
              qtdinfantil_reserva: "0",
              vlinfantil_reserva: "0.00",
              qtespecial: "0",
              vlespecial: "0.00",
              qtdcortesia: "0",
              qtdisento: "0",
            },
          ],
        };
      }

      return {
        rows: [
          {
            idcompra: 551,
            idvoucher: 9001,
            numvoucher: "ABC-123",
            dtcompra: "2026-05-06",
            dtagenda: "2026-05-08",
            tpvoucher: "norma",
            descricao: null,
            identificacao: "Cliente Teste",
            tpcompra: "ponli",
            stcompra: "conc",
            vlunicompra: "40.00",
            stusado: "n",
            dtuso: null,
            hruso: null,
          },
        ],
      };
    });

    await expect(
      listPainelPurchaseVouchers({
        page: "1",
        filters: {
          tpcompra: "site",
        },
      }),
    ).resolves.toEqual({
      items: [
        {
          purchaseId: 551,
          voucherId: 9001,
          voucherNumber: "ABC-123",
          purchaseDate: "06/05/2026",
          visitDate: "08/05/2026",
          ticketTypeLabel: "Passaporte",
          name: "Cliente Teste",
          location: "ponli",
          locationLabel: "SITE",
          unitValue: "40,00",
          purchaseStatusLabel: "Concluida",
          usedLabel: "Nao",
          usedDate: null,
          usedTime: null,
          purchaseTypeLabel: "Compra",
        },
      ],
      total: 1,
      page: 1,
      perPage: 100,
      totalPages: 1,
      filters: {
        voucherId: null,
        purchaseDateFrom: null,
        purchaseDateTo: null,
        usedDateFrom: null,
        usedDateTo: null,
        visitDateFrom: null,
        visitDateTo: null,
        voucherType: null,
        purchaseLocation: "site",
        purchaseStatus: null,
        usedStatus: null,
      },
      indicators: {
        qtdnormal_site: 1,
        vlnormal_site: "40,00",
        qtdinfantil_site: 0,
        vlinfantil_site: "0,00",
        qtdnormal_parque: 0,
        vlnormal_parque: "0,00",
        qtdinfantil_parque: 0,
        vlinfantil_parque: "0,00",
        qtdescola: 0,
        vlescola: "0,00",
        qtdadulto_reserva: 0,
        vladulto_reserva: "0,00",
        qtdinfantil_reserva: 0,
        vlinfantil_reserva: "0,00",
        qtespecial: 0,
        vlespecial: "0,00",
        qtdcortesia: 0,
        qtdisento: 0,
        totalCount: 1,
        totalValue: "40,00",
      },
    });
  });
});
