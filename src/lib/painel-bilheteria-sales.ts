export const PAINEL_BILHETERIA_SALE_DRAFT_KEY = "painel-bilheteria-sale-draft";

export type PainelBilheteriaSaleDraftItem = {
  type: "norma" | "infan" | "isent";
  quantity: number;
  label: string;
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
  agendaId: number;
  agendaLabel: string;
  cpf: string;
  items: PainelBilheteriaSaleDraftItem[];
  courtesies: PainelBilheteriaSaleDraftCourtesy[];
  purchaseDiscountId: number | null;
  purchaseDiscountLabel: string | null;
  discountValue: string;
  subtotalValue: string;
  totalValue: string;
  reason: string;
  createdAt: string;
};
