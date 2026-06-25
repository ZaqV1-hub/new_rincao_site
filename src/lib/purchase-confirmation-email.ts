import { getIngressoDbPool } from "@/lib/ingresso-db";
import { getSiteUrl } from "@/lib/site-metadata";

type ConfirmedPurchaseEmailRow = {
  idcompra: number;
  stcompra: string | null;
  flenvio: string | null;
  dtpagamento: string | null;
  email: string | null;
  nmusuario: string | null;
};

type QueuePurchaseConfirmationEmailResult = {
  status: "queued" | "skipped";
  purchaseId: number;
  reason?: string;
};

let emailQueueTableExistsCache: boolean | null = null;

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function buildBuyerConfirmationEmailHtml(purchase: ConfirmedPurchaseEmailRow) {
  const vouchersUrl = new URL("/meus-ingressos", getSiteUrl()).toString();

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charSet="UTF-8" />
        <title>Estancia - Compra</title>
      </head>
      <body style="margin:0;padding:24px;background:#f0ede5;color:#4a5560;font-family:Arial,Helvetica,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-collapse:collapse;">
                <tr>
                  <td style="background:#175387;padding:24px 32px;color:#ffffff;font-size:28px;line-height:1.3;">
                    Pagamento Realizado com <strong>sucesso</strong>!
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 32px 16px;font-size:15px;line-height:1.7;">
                    Ola <strong>${escapeHtml(purchase.nmusuario ?? "")}</strong>,
                    <br /><br />
                    O pagamento do pedido <strong>${escapeHtml(String(purchase.idcompra))}</strong> foi confirmado com sucesso em ${escapeHtml(formatDate(purchase.dtpagamento))}.
                    <br /><br />
                    Os vouchers ja estao disponiveis para emissao.
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 28px;">
                    <a
                      href="${escapeHtml(vouchersUrl)}"
                      style="background:#009933;display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-size:15px;"
                    >
                      Faca o download dos vouchers
                    </a>
                    <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">
                      Caso nao consiga clicar no botao acima, acesse:
                      <a href="${escapeHtml(vouchersUrl)}" style="color:#0f7d37;">${escapeHtml(vouchersUrl)}</a>
                    </p>
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

async function emailQueueTableExists() {
  if (emailQueueTableExistsCache !== null) {
    return emailQueueTableExistsCache;
  }

  const pool = getIngressoDbPool();
  const result = await pool.query<{ regclass: string | null }>(
    "SELECT to_regclass('public.email')::text AS regclass",
  );

  emailQueueTableExistsCache = Boolean(result.rows[0]?.regclass);

  return emailQueueTableExistsCache;
}

async function loadConfirmedPurchase(purchaseId: number) {
  const pool = getIngressoDbPool();
  const result = await pool.query<ConfirmedPurchaseEmailRow>(
    `
      SELECT
        compra.idcompra,
        compra.stcompra,
        compra.flenvio,
        compra.dtpagamento::text AS dtpagamento,
        usuario.email,
        usuario.nmusuario
      FROM compra
      LEFT JOIN usuario ON usuario.cpf = compra.cpf
      WHERE compra.idcompra = $1
      LIMIT 1
    `,
    [purchaseId],
  );

  return result.rows[0] ?? null;
}

async function markPurchaseEmailQueued(purchaseId: number) {
  const pool = getIngressoDbPool();

  await pool.query(
    `
      UPDATE compra
      SET flenvio = 'sim'
      WHERE idcompra = $1
    `,
    [purchaseId],
  );
}

export function resetPurchaseConfirmationEmailCacheForTests() {
  emailQueueTableExistsCache = null;
}

export async function queuePurchaseConfirmationEmail(
  purchaseId: number,
): Promise<QueuePurchaseConfirmationEmailResult> {
  const purchase = await loadConfirmedPurchase(purchaseId);

  if (!purchase || purchase.stcompra !== "conc") {
    return {
      status: "skipped",
      purchaseId,
      reason: "purchase_not_confirmed",
    };
  }

  if (String(purchase.flenvio ?? "").trim().toLowerCase() === "sim") {
    return {
      status: "skipped",
      purchaseId,
      reason: "purchase_email_already_queued",
    };
  }

  const recipientEmail = String(purchase.email ?? "").trim();

  if (!recipientEmail) {
    return {
      status: "skipped",
      purchaseId,
      reason: "purchase_email_missing_recipient",
    };
  }

  if (!(await emailQueueTableExists())) {
    return {
      status: "skipped",
      purchaseId,
      reason: "email_queue_unavailable",
    };
  }

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
      recipientEmail,
      purchase.nmusuario ?? recipientEmail,
      "ingressos@estancia.local",
      "Estancia - Compra",
      buildBuyerConfirmationEmailHtml(purchase),
    ],
  );
  await markPurchaseEmailQueued(purchaseId);

  return {
    status: "queued",
    purchaseId,
  };
}
