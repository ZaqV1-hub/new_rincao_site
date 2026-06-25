import { getIngressoDbPool } from "@/lib/ingresso-db";

type PurchaseCashbackRow = {
  idcompra: number;
  codindica: string | null;
  stcompra: string | null;
  cpf: string | null;
  dtpagamento: string | null;
  nmusuario: string | null;
  vltotcompra: string | null;
  vltotdesc: string | null;
  vlcomiss: string | null;
};

type CodindicaCashbackRow = Record<string, unknown> & {
  codindica: string;
  nmrepresentante?: string | null;
  email?: string | null;
  percomissao?: string | null;
  tpcashback?: string | null;
  vlcashback?: string | null;
  vlcashbacknormal?: string | null;
  vlcashbackinfant?: string | null;
  vlcashbackpromonormal?: string | null;
  vlcashbackpromoinfant?: string | null;
  flpromocional?: string | null;
};

type VoucherSummaryRow = {
  total_itens: string;
  total_normal: string;
  total_infantil: string;
  tpagenda: string | null;
};

type CashbackProcessResult = {
  status: "processed" | "skipped";
  purchaseId: number;
  amount: string;
  reason?: string;
};

type CashbackHistoryRow = {
  idcompra: number;
  stemail: string | null;
  email: string | null;
};

const tableExistsCache = new Map<string, boolean>();

function toMoney(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function normalizeFlag(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "s" ? "s" : "n";
}

function normalizeCashbackType(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "fixo"
    ? "fixo"
    : "percentual";
}

function isPromotionalAgenda(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "promo";
}

function readMoney(row: Record<string, unknown>, key: string) {
  return toMoney(row[key]);
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(value: number | string | null | undefined) {
  const amount = toMoney(value);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Nao informado";
  }

  const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return "Nao informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(parsed);
}

function usesNewRule(row: CodindicaCashbackRow) {
  return (
    readMoney(row, "vlcashbacknormal") > 0 ||
    readMoney(row, "vlcashbackinfant") > 0 ||
    readMoney(row, "vlcashbackpromonormal") > 0 ||
    readMoney(row, "vlcashbackpromoinfant") > 0 ||
    normalizeFlag(row.flpromocional) === "s"
  );
}

function calculateCashbackAmount(
  purchase: PurchaseCashbackRow,
  code: CodindicaCashbackRow,
  voucherSummary: VoucherSummaryRow,
) {
  const totalItems = Math.max(Number(voucherSummary.total_itens ?? 0), 0);
  const totalNormal = Math.max(Number(voucherSummary.total_normal ?? 0), 0);
  const totalInfantil = Math.max(Number(voucherSummary.total_infantil ?? 0), 0);
  const totalPurchaseValue = toMoney(purchase.vltotcompra);

  if (usesNewRule(code)) {
    const normalValue = isPromotionalAgenda(voucherSummary.tpagenda)
      ? readMoney(code, "vlcashbackpromonormal")
      : readMoney(code, "vlcashbacknormal");
    const infantValue = isPromotionalAgenda(voucherSummary.tpagenda)
      ? readMoney(code, "vlcashbackpromoinfant")
      : readMoney(code, "vlcashbackinfant");

    return Number(
      (normalValue * totalNormal + infantValue * totalInfantil).toFixed(2),
    );
  }

  const cashbackType = normalizeCashbackType(
    code.tpcashback ?? code.tpcashback,
  );
  const cashbackValue = toMoney(code.vlcashback ?? code.percomissao);

  if (cashbackType === "fixo") {
    return Number((cashbackValue * totalItems).toFixed(2));
  }

  return Number((totalPurchaseValue * (cashbackValue / 100)).toFixed(2));
}

async function tableExists(tableName: string) {
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName) === true;
  }

  const pool = getIngressoDbPool();
  const result = await pool.query<{ regclass: string | null }>(
    "SELECT to_regclass($1)::text AS regclass",
    [tableName],
  );
  const exists = Boolean(result.rows[0]?.regclass);

  tableExistsCache.set(tableName, exists);

  return exists;
}

async function historyTableExists() {
  return tableExists("public.codindica_cashback");
}

async function emailQueueTableExists() {
  return tableExists("public.email");
}

async function cashbackPaymentTableExists() {
  return tableExists("public.codindica_cashback_pagamento");
}

export function resetCodindicaCashbackTableCacheForTests() {
  tableExistsCache.clear();
}

function buildRepresentativeEmailHtml(input: {
  purchase: PurchaseCashbackRow;
  code: CodindicaCashbackRow;
  cashbackAmount: number;
  availableBalance: number;
}) {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charSet="UTF-8" />
        <title>Estancia - Compra Finalizada</title>
      </head>
      <body style="margin:0;padding:24px;background:#f0ede5;color:#4a5560;font-family:Arial,Helvetica,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-collapse:collapse;">
                <tr>
                  <td style="background:#175387;padding:24px 32px;color:#ffffff;font-size:28px;line-height:1.3;">
                    Compra Finalizada com <strong>Sucesso</strong>!
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 32px 16px;font-size:15px;line-height:1.7;">
                    Ola <strong>${escapeHtml(input.code.nmrepresentante ?? "")}</strong>,
                    <br /><br />
                    Uma compra foi finalizada utilizando o seu codigo de indicacao
                    <strong>${escapeHtml(input.purchase.codindica ?? input.code.codindica)}</strong>.
                    <br /><br />
                    Abaixo estao os dados da venda, o cashback gerado nesta compra e o total disponivel para receber ate agora.
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 28px;">
                    <table width="100%" cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#d5dde5;font-size:14px;">
                      <tr>
                        <td><strong>Compra No</strong></td>
                        <td>${escapeHtml(String(input.purchase.idcompra))}</td>
                      </tr>
                      <tr>
                        <td><strong>Comprador</strong></td>
                        <td>${escapeHtml(input.purchase.nmusuario ?? "")}</td>
                      </tr>
                      <tr>
                        <td><strong>Data Pagamento</strong></td>
                        <td>${escapeHtml(formatDate(input.purchase.dtpagamento))}</td>
                      </tr>
                      <tr>
                        <td><strong>Valor Compra</strong></td>
                        <td>${escapeHtml(formatMoney(input.purchase.vltotcompra))}</td>
                      </tr>
                      <tr>
                        <td><strong>Cashback Gerado</strong></td>
                        <td>${escapeHtml(formatMoney(input.cashbackAmount))}</td>
                      </tr>
                      <tr>
                        <td><strong>Total Disponivel para Receber</strong></td>
                        <td>${escapeHtml(formatMoney(input.availableBalance))}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:11px;color:#6b7280;">
                Esta e uma mensagem gerada automaticamente, nao responda.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `.trim();
}

async function loadHistory(purchaseId: number) {
  if (!(await historyTableExists())) {
    return null;
  }

  const pool = getIngressoDbPool();
  const result = await pool.query<CashbackHistoryRow>(
    `
      SELECT idcompra, stemail, email
      FROM codindica_cashback
      WHERE idcompra = $1
      LIMIT 1
    `,
    [purchaseId],
  );

  return result.rows[0] ?? null;
}

async function updateHistoryEmailStatus(
  purchaseId: number,
  status: string,
  message?: string,
) {
  if (!(await historyTableExists())) {
    return;
  }

  const pool = getIngressoDbPool();
  const trimmedMessage = String(message ?? "").trim();

  await pool.query(
    `
      UPDATE codindica_cashback
      SET
        stemail = $2,
        msgemail = NULLIF($3, ''),
        dtenvio = CASE WHEN $2 = 'enviado' THEN CURRENT_DATE ELSE dtenvio END,
        hrenvio = CASE WHEN $2 = 'enviado' THEN CURRENT_TIME ELSE hrenvio END
      WHERE idcompra = $1
    `,
    [purchaseId, status, trimmedMessage],
  );
}

async function loadCashbackSummary(code: string) {
  if (!(await historyTableExists())) {
    return {
      generated: 0,
      paid: 0,
      available: 0,
    };
  }

  const pool = getIngressoDbPool();
  const generatedResult = await pool.query<{ total: string }>(
    `
      SELECT COALESCE(SUM(hist.vlcashback), 0)::text AS total
      FROM codindica_cashback hist
      JOIN compra ON compra.idcompra = hist.idcompra
      WHERE hist.codindica = $1
        AND hist.stcashback = 'gerado'
        AND compra.stcompra = 'conc'
    `,
    [code],
  );
  let paid = 0;

  if (await cashbackPaymentTableExists()) {
    const paidResult = await pool.query<{ total: string }>(
      `
        SELECT COALESCE(SUM(vlpagamento), 0)::text AS total
        FROM codindica_cashback_pagamento
        WHERE codindica = $1
      `,
      [code],
    );
    paid = toMoney(paidResult.rows[0]?.total);
  }

  const generated = toMoney(generatedResult.rows[0]?.total);

  return {
    generated,
    paid,
    available: Math.max(Number((generated - paid).toFixed(2)), 0),
  };
}

async function enqueueRepresentativeEmail(
  purchase: PurchaseCashbackRow,
  code: CodindicaCashbackRow,
  cashbackAmount: number,
) {
  if (!(await historyTableExists())) {
    return;
  }

  const representativeEmail = String(code.email ?? "").trim();

  if (!representativeEmail) {
    await updateHistoryEmailStatus(
      purchase.idcompra,
      "sem_destinatario",
      "Representante sem email cadastrado.",
    );
    return;
  }

  const history = await loadHistory(purchase.idcompra);

  if (history?.stemail === "enviado" || history?.stemail === "pendente") {
    return;
  }

  if (!(await emailQueueTableExists())) {
    await updateHistoryEmailStatus(
      purchase.idcompra,
      "falha",
      "Fila de email indisponivel no ambiente atual.",
    );
    return;
  }

  const summary = await loadCashbackSummary(code.codindica);
  const pool = getIngressoDbPool();

  await pool.query(
    `
      INSERT INTO email (
        de,
        nomede,
        para,
        nomepara,
        resppara,
        assunto,
        conteudo,
        dtemail,
        hremail,
        stemail,
        erros
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, CURRENT_TIME, 'nov', 0
      )
    `,
    [
      "ingressos@estancia.local",
      "Ingressos Estancia",
      representativeEmail,
      code.nmrepresentante ?? representativeEmail,
      "ingressos@estancia.local",
      "Estancia - Compra Finalizada",
      buildRepresentativeEmailHtml({
        purchase,
        code,
        cashbackAmount,
        availableBalance: summary.available,
      }),
    ],
  );

  await updateHistoryEmailStatus(
    purchase.idcompra,
    "pendente",
    "Email do representante enfileirado no BFF.",
  );
}

async function loadPurchase(purchaseId: number) {
  const pool = getIngressoDbPool();
  const result = await pool.query<PurchaseCashbackRow>(
    `
      SELECT
        idcompra,
        codindica,
        stcompra,
        compra.cpf,
        compra.dtpagamento::text AS dtpagamento,
        usuario.nmusuario,
        vltotcompra::text AS vltotcompra,
        vltotdesc::text AS vltotdesc,
        vlcomiss::text AS vlcomiss
      FROM compra
      LEFT JOIN usuario ON usuario.cpf = compra.cpf
      WHERE idcompra = $1
      LIMIT 1
    `,
    [purchaseId],
  );

  return result.rows[0] ?? null;
}

async function loadCodindica(code: string) {
  const pool = getIngressoDbPool();
  const result = await pool.query<CodindicaCashbackRow>(
    "SELECT * FROM codindica WHERE codindica = $1 LIMIT 1",
    [code],
  );

  return result.rows[0] ?? null;
}

async function loadVoucherSummary(purchaseId: number) {
  const pool = getIngressoDbPool();
  const result = await pool.query<VoucherSummaryRow>(
    `
      SELECT
        COUNT(*) FILTER (WHERE voucher.tpvoucher IN ('norma', 'infan', 'escol'))::text AS total_itens,
        COUNT(*) FILTER (WHERE voucher.tpvoucher = 'norma')::text AS total_normal,
        COUNT(*) FILTER (WHERE voucher.tpvoucher = 'infan')::text AS total_infantil,
        MIN(agenda.tpagenda) AS tpagenda
      FROM voucher
      LEFT JOIN agenda ON agenda.idagenda = voucher.idagenda
      WHERE voucher.idcompra = $1
    `,
    [purchaseId],
  );

  return (
    result.rows[0] ?? {
      total_itens: "0",
      total_normal: "0",
      total_infantil: "0",
      tpagenda: null,
    }
  );
}

async function updatePurchaseCashback(purchaseId: number, amount: number) {
  const pool = getIngressoDbPool();

  await pool.query(
    `
      UPDATE compra
      SET vlcomiss = $2
      WHERE idcompra = $1
    `,
    [purchaseId, amount.toFixed(2)],
  );
}

async function syncHistoryCashback(
  purchase: PurchaseCashbackRow,
  code: CodindicaCashbackRow,
  voucherSummary: VoucherSummaryRow,
  amount: number,
) {
  if (!(await historyTableExists())) {
    return;
  }

  const pool = getIngressoDbPool();
  const existing = await pool.query<{ idcompra: number }>(
    "SELECT idcompra FROM codindica_cashback WHERE idcompra = $1 LIMIT 1",
    [purchase.idcompra],
  );
  const payload = [
    purchase.idcompra,
    purchase.codindica,
    code.nmrepresentante ?? null,
    code.email ?? null,
    normalizeCashbackType(code.tpcashback),
    purchase.vltotcompra ?? "0.00",
    purchase.vltotcompra ?? "0.00",
    purchase.vltotdesc ?? "0.00",
    Number(voucherSummary.total_itens ?? 0),
    amount.toFixed(2),
  ];

  if (existing.rowCount === 0) {
    await pool.query(
      `
        INSERT INTO codindica_cashback (
          idcompra,
          codindica,
          nmrepresentante,
          email,
          tpcashback,
          vlbase,
          vlcompra,
          vldesconto,
          qtitens,
          vlcashback,
          stcashback,
          stemail
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'gerado', 'pendente'
        )
      `,
      payload,
    );
    return;
  }

  await pool.query(
    `
      UPDATE codindica_cashback
      SET
        codindica = $2,
        nmrepresentante = $3,
        email = $4,
        tpcashback = $5,
        vlbase = $6,
        vlcompra = $7,
        vldesconto = $8,
        qtitens = $9,
        vlcashback = $10,
        stcashback = 'gerado'
      WHERE idcompra = $1
    `,
    payload,
  );
}

async function cancelHistoryCashback(purchaseId: number) {
  if (!(await historyTableExists())) {
    return;
  }

  const pool = getIngressoDbPool();

  await pool.query(
    `
      UPDATE codindica_cashback
      SET
        stcashback = 'cancelado',
        dtcancelamento = CURRENT_DATE,
        hrcancelamento = CURRENT_TIME
      WHERE idcompra = $1
    `,
    [purchaseId],
  );
}

export async function processCodindicaCashback(
  purchaseId: number,
): Promise<CashbackProcessResult> {
  const purchase = await loadPurchase(purchaseId);

  if (!purchase || purchase.stcompra !== "conc" || !purchase.codindica) {
    return {
      status: "skipped",
      purchaseId,
      amount: "0.00",
      reason: "purchase_not_eligible",
    };
  }

  const code = await loadCodindica(purchase.codindica);

  if (!code) {
    return {
      status: "skipped",
      purchaseId,
      amount: "0.00",
      reason: "codindica_not_found",
    };
  }

  const voucherSummary = await loadVoucherSummary(purchaseId);
  const amount = calculateCashbackAmount(purchase, code, voucherSummary);

  await updatePurchaseCashback(purchaseId, amount);
  await syncHistoryCashback(purchase, code, voucherSummary, amount);

  try {
    await enqueueRepresentativeEmail(purchase, code, amount);
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Falha controlada ao enfileirar email do representante.";

    await updateHistoryEmailStatus(purchaseId, "falha", message).catch(
      () => undefined,
    );
  }

  return {
    status: "processed",
    purchaseId,
    amount: amount.toFixed(2),
  };
}

export async function cancelCodindicaCashback(
  purchaseId: number,
): Promise<CashbackProcessResult> {
  await updatePurchaseCashback(purchaseId, 0);
  await cancelHistoryCashback(purchaseId);

  return {
    status: "processed",
    purchaseId,
    amount: "0.00",
  };
}
