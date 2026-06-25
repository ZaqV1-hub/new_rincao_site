import { getIngressoDbPool } from "@/lib/ingresso-db";
import { registerOpsAuditLog } from "@/lib/ops-audit-log";

type TicketDeliveryAuditResult = {
  status: "sent" | "skipped";
  purchaseId: number;
  sentVoucherIds: number[];
  skippedReason?: string;
};

type TicketDeliveryAuditInput = {
  purchaseId: number;
  trigger: "payment_reconciliation" | "delivery_recovery";
  gatewayPaymentId?: string | null;
  gatewayStatus?: number | null;
  result?: TicketDeliveryAuditResult;
  error?: unknown;
};

function buildDescription(
  purchaseId: number,
  outcome: "sent" | "skipped" | "failed",
) {
  if (outcome === "sent") {
    return `Entrega automatica do ingresso concluida para a compra ${purchaseId}.`;
  }

  if (outcome === "skipped") {
    return `Entrega automatica do ingresso ignorada para a compra ${purchaseId}.`;
  }

  return `Entrega automatica do ingresso falhou para a compra ${purchaseId}.`;
}

function buildReason(trigger: TicketDeliveryAuditInput["trigger"]) {
  if (trigger === "payment_reconciliation") {
    return "Fluxo automatico disparado pela conciliacao do pagamento.";
  }

  return "Fluxo automatico disparado pela rotina de recuperacao de entrega.";
}

function normalizeErrorMessage(error: unknown) {
  return error instanceof Error ?
      error.message :
      "Falha inesperada ao enviar o ingresso.";
}

export async function registerTicketDeliveryAudit(
  input: TicketDeliveryAuditInput,
) {
  const outcome =
    input.error ? "failed" : (input.result?.status ?? "skipped");
  const pool = getIngressoDbPool();
  const client = await pool.connect();

  try {
    await registerOpsAuditLog(client, {
      origem: "ticket-delivery",
      acao: outcome,
      compraId: input.purchaseId,
      descricao: buildDescription(input.purchaseId, outcome),
      motivo: buildReason(input.trigger),
      usuarioNome:
        input.trigger === "payment_reconciliation" ? "gateway" : "scheduler",
      detalhes: {
        trigger: input.trigger,
        purchaseId: input.purchaseId,
        gatewayPaymentId: input.gatewayPaymentId ?? null,
        gatewayStatus: input.gatewayStatus ?? null,
        sentVoucherIds: input.result?.sentVoucherIds ?? [],
        skippedReason: input.result?.skippedReason ?? null,
        error: input.error ? normalizeErrorMessage(input.error) : null,
      },
    });
  } finally {
    client.release();
  }
}
