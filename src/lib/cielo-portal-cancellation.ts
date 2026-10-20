import { getIngressoSistemaDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";
import { syncTicketValidation } from "@/lib/ticket-service";
import { cancelCodindicaCashback } from "@/lib/codindica-cashback";

type PurchaseRow = {
  idcompra: number;
  stcompra: string;
  tpcompra: string;
  formapag: string;
  vltotcompra: string;
};

type PaymentRow = {
  idpagseguro: string;
  status: number;
  cancellation_source: string | null;
};

export class CieloPortalCancellationError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function markCieloPortalCancelled(input: {
  purchaseId: number;
  paymentId: string;
  amount: number;
  evidence: string;
  actorName?: string | null;
}) {
  const paymentId = input.paymentId.trim();
  const evidence = input.evidence.trim();
  if (!Number.isSafeInteger(input.purchaseId) || input.purchaseId <= 0 ||
      !/^[0-9a-f-]{36}$/i.test(paymentId) || !Number.isFinite(input.amount) ||
      input.amount <= 0 || evidence.length < 12 || evidence.length > 500) {
    throw new CieloPortalCancellationError("invalid_portal_cancellation", "Informe compra, pagamento, valor e comprovante da Cielo validos.", 400);
  }

  const client = await getIngressoSistemaDbPool().connect();
  let voucherIds: number[] = [];
  let usedCount = 0;
  let auditLogId: number | null = null;
  try {
    await client.query("BEGIN");
    const purchase = (await client.query<PurchaseRow>(
      "SELECT idcompra, stcompra, tpcompra, formapag, vltotcompra::text FROM compra WHERE idcompra = $1 FOR UPDATE",
      [input.purchaseId],
    )).rows[0];
    const payment = (await client.query<PaymentRow>(
      'SELECT idpagseguro, status, "cancellationSource" AS cancellation_source FROM pagpagseguro WHERE idcompra = $1 FOR UPDATE',
      [input.purchaseId],
    )).rows[0];
    if (!purchase || !payment || purchase.tpcompra !== "ponli" ||
        purchase.formapag !== "pgseg" || payment.idpagseguro.toLowerCase() !== paymentId.toLowerCase() ||
        Math.abs(Math.round(Number(purchase.vltotcompra) * 100) - Math.round(input.amount * 100)) > 1) {
      throw new CieloPortalCancellationError("portal_cancellation_mismatch", "Compra, pagamento ou valor nao conferem com o registro do site.", 409);
    }
    if (payment.cancellation_source === "portal" && purchase.stcompra === "canc") {
      throw new CieloPortalCancellationError("portal_cancellation_already_recorded", "Cancelamento do portal ja registrado.", 409);
    }
    if (purchase.stcompra !== "conc" || payment.status !== 3) {
      throw new CieloPortalCancellationError("portal_cancellation_status_conflict", "A compra nao esta concluida com pagamento confirmado no site.", 409);
    }

    const vouchers = await client.query<{ idvoucher: number; stusado: string }>(
      "SELECT idvoucher, stusado FROM voucher WHERE idcompra = $1 FOR UPDATE",
      [input.purchaseId],
    );
    usedCount = vouchers.rows.filter((voucher) => voucher.stusado === "s").length;
    voucherIds = vouchers.rows.filter((voucher) => voucher.stusado === "n").map((voucher) => voucher.idvoucher);

    await client.query("UPDATE compra SET stcompra = 'canc' WHERE idcompra = $1", [input.purchaseId]);
    await client.query('UPDATE pagpagseguro SET "cancellationSource" = $2 WHERE idcompra = $1', [input.purchaseId, "portal"]);
    if (voucherIds.length > 0) {
      await client.query(
        `UPDATE voucher SET stusado = 'inv',
          dtuso = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
          hruso = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::time
        WHERE idvoucher = ANY($1::int[]) AND stusado = 'n'`,
        [voucherIds],
      );
    }
    auditLogId = await registerOpsAuditLog(client, {
      origem: "compra",
      acao: "cancelar",
      compraId: input.purchaseId,
      descricao: `Cancelamento externo Cielo registrado para compra ${input.purchaseId}`,
      motivo: evidence,
      usuarioNome: input.actorName || "Conciliacao Cielo portal",
      detalhes: { paymentId, amount: input.amount, source: "portal", voucherIds, usedCount },
    }, "postgres");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const warnings: string[] = [];
  if (voucherIds.length > 0) {
    try {
      const sync = await syncTicketValidation(voucherIds.map((voucherId) => ({ purchaseId: input.purchaseId, voucherId })), "invalidate");
      if (sync.status !== "sent") warnings.push(`Sincronizacao dos tickets pendente: ${sync.skippedReason ?? sync.status}`);
    } catch (error) {
      console.error("cielo-portal-ticket-invalidation-failed", error);
      warnings.push("Sincronizacao dos tickets falhou; conferir servico externo.");
    }
  }
  try {
    await cancelCodindicaCashback(input.purchaseId);
  } catch (error) {
    console.error("cielo-portal-cashback-cancellation-failed", error);
    warnings.push("Cancelamento do cashback falhou; conferir saldo do representante.");
  }
  if (usedCount > 0) warnings.push(`${usedCount} ingresso(s) ja utilizado(s) antes do cancelamento.`);
  return { purchaseId: input.purchaseId, status: "canc" as const, invalidatedVoucherIds: voucherIds, usedCount, auditLogId, warnings };
}
