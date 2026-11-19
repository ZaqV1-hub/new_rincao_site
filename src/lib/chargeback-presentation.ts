import type { ChargebackEvidence } from "@/lib/chargeback-dossier";
import type { PainelPurchaseDetail } from "@/lib/painel-compras";

export function dossierDate(value: string | null | undefined) {
  if (!value) return "Não informada";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Não informada";
}

export function buildChargebackPurchaseSummary(evidence: ChargebackEvidence): Omit<PainelPurchaseDetail, "operational"> {
  const payment = evidence.paymentAttempts.find((entry) => "id" in entry && entry.id === evidence.paymentId);
  const selected = payment && "id" in payment ? payment : null;
  const money = (value: number | null | undefined) =>
    value == null ? "-" : (value / 100).toFixed(2).replace(".", ",");
  return {
    purchaseId: evidence.purchaseId ?? 0,
    purchaseDate: dossierDate(evidence.purchase?.date),
    type: "ponli",
    typeLabel: "Compra",
    status: evidence.purchase?.status ?? "",
    statusLabel: evidence.purchase?.status === "conc" ? "Concluída" : evidence.purchase?.status === "canc" ? "Cancelada" : "Não informado",
    paymentLabel: selected?.status === "2" ? "Cielo - Paga" : "Cielo - Conferir pagamento",
    paymentMethodLabel: selected?.method === "CreditCard" ? "Cartão de crédito" :
      selected?.method === "DebitCard" ? "Cartão de débito" : selected?.method === "Pix" ? "Pix" : "Cartão",
    paymentDate: dossierDate(selected?.capturedAt || selected?.receivedAt),
    paymentTime: (selected?.capturedAt || selected?.receivedAt || "").slice(11, 19) || null,
    totalValue: money(evidence.purchase?.totalCents),
    cpf: evidence.purchase?.buyerCpf?.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") ?? null,
    userName: evidence.purchase?.buyerName || selected?.buyerName || null,
    referralCode: null,
    gatewayPaymentId: evidence.paymentId,
    gatewayStatusCode: selected?.ledgerStatus || null,
    gatewayStatusLabel: selected?.status === "2" ? "Paga" : "Não informado",
    vouchers: evidence.vouchers.map((voucher) => ({
      voucherId: voucher.id,
      voucherNumber: voucher.number,
      visitDate: dossierDate(voucher.visitDate),
      voucherType: voucher.schoolName ? "escol" : "norma",
      voucherTypeLabel: voucher.category,
      schoolName: voucher.schoolName ?? null,
      studentName: voucher.studentName ?? null,
      className: voucher.className ?? null,
      periodName: null,
      unitValue: money(voucher.unitCents),
      used: voucher.state === "used" ? "s" : voucher.state === "invalidated" ? "inv" : "n",
      usedLabel: voucher.state === "used" ? "Sim" : voucher.state === "invalidated" ? "Invalidado" : "Não",
      usedDate: voucher.usedAt ? dossierDate(voucher.usedAt) : null,
      usedTime: voucher.usedAt?.slice(11, 19) || null,
      schoolTripHref: null,
    })),
  };
}
