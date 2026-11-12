export const PAINEL_BILHETERIA_SALE_DRAFT_KEY = "painel-bilheteria-sale-draft";

export type PainelBilheteriaSaleDraftItem = {
  type: "norma" | "infan" | "isent";
  quantity: number;
  label: string;
  discountId: number | null;
  discountLabel: string | null;
  baseUnitValue: string;
  unitValue: string;
  totalValue: string;
};

export type PainelBilheteriaSaleDraftCourtesy = {
  authorId: number;
  authorName: string;
  quantity: number;
  identification: string;
  note: string;
};

export type PainelBilheteriaSaleDraft = {
  periodId: number;
  agendaId: number;
  agendaLabel: string;
  cpf: string;
  items: PainelBilheteriaSaleDraftItem[];
  courtesies: PainelBilheteriaSaleDraftCourtesy[];
  services: PainelBilheteriaSaleDraftService[];
  discountValue: string;
  subtotalValue: string;
  totalValue: string;
  reason: string;
  createdAt: string;
};

export type PainelBilheteriaSaleDraftService = {
  serviceId: number; quantity: number; label: string; unitValue: string; totalValue: string;
};
export function saleDraftStorageKey(periodId: number) { return `${PAINEL_BILHETERIA_SALE_DRAFT_KEY}:${periodId}`; }
export function saleCommandStorageKey(periodId: number) { return `painel-cash-sale:${periodId}`; }
export function reservationCommandStorageKey(periodId: number, purchaseId: number) { return `painel-cash-reservation:${periodId}:${purchaseId}`; }
export const CASH_PAYMENT_OPTIONS = [
  { value: "dinhe", label: "Dinheiro" }, { value: "debit", label: "Débito" },
  { value: "credi", label: "Crédito" }, { value: "pix", label: "Pix" },
];
export function cashInputCents(value: string): number | null {
  const input = value.trim().replace(/^R\$\s*/i, "");
  if (input.includes(",") && !/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(input)) return null;
  const normalized = input.includes(",") ? input.replace(/\./g, "").replace(",", ".") : input;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= 9999999999 ? amount : null;
}
export function previewCashPayments(totalCents: number, rows: { method: string; value: string }[]) {
  let receivedCents = 0, cashCents = 0;
  const payments: { method: string; value: string }[] = [];
  for (const row of rows) {
    const cents = cashInputCents(row.value);
    if (cents === null || cents <= 0 || !CASH_PAYMENT_OPTIONS.some((option) => option.value === row.method)) return { ok: false as const, message: "Informe uma forma e um valor válido em cada pagamento." };
    payments.push({ method: row.method, value: (cents / 100).toFixed(2) });
    receivedCents += cents; if (row.method === "dinhe") cashCents += cents;
  }
  const changeCents = receivedCents - totalCents;
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > 9999999999 || receivedCents > 9999999999 || changeCents < 0 || changeCents > cashCents) return { ok: false as const, message: "O valor entregue deve cobrir o total; troco só pode sair do dinheiro entregue." };
  return { ok: true as const, payments, receivedCents, changeCents };
}
export function saleCommandPayload(draft: PainelBilheteriaSaleDraft, payments: { method: string; value: string }[]) {
  return { periodId: draft.periodId, agendaId: draft.agendaId, cpf: draft.cpf,
    items: draft.items.map(({ type, quantity, label, discountId }) => ({ type, quantity, label, discountId })),
    services: draft.services.map(({ serviceId, quantity }) => ({ serviceId, quantity })),
    courtesies: draft.courtesies.map(({ authorId, quantity, identification, note }) => ({ authorId, quantity, identification, note })),
    payments, reason: draft.reason };
}

export function discountedCashUnitCents(baseCents: number, valueCents: number, type: string) {
  if (type === "percentual") return Number((BigInt(baseCents) * BigInt(Math.max(0, 10000 - valueCents)) + BigInt(5000)) / BigInt(10000));
  if (type === "valor_fixo") return Math.max(0, baseCents - valueCents);
  return baseCents;
}
