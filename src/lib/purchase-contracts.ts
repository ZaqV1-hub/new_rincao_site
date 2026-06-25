import type { ReservationAgendaDetail } from "@/lib/reservation-contracts";
import type { B2cCartLineItem } from "@/lib/b2c-catalog";

export type PurchasePricingMode = "dia" | "conve" | "socio";

export type PurchasePricing = {
  mode: PurchasePricingMode;
  label: string;
  discountedNormal: string;
  discountedChild: string;
  standardNormal: string;
  standardChild: string;
  discountedRemaining: number;
};

export type PurchaseAgendaDetail = ReservationAgendaDetail & {
  pricing: PurchasePricing;
};

export type CreatePurchaseQuantities = {
  discountedNormal: number;
  discountedChild: number;
  normal: number;
  child: number;
  exempt: number;
};

export type CreatePurchaseSelection =
  | CreatePurchaseQuantities
  | {
      lineItems: B2cCartLineItem[];
    };

export type CreatePurchaseRequest = {
  agendaId: number;
  codindica?: string;
  quantities?: CreatePurchaseQuantities;
  lineItems?: B2cCartLineItem[];
};

export type CreatePurchaseResponse = {
  ok: true;
  data: {
    purchaseId: number;
    legacyEncodedId: string;
    totalValue: string;
    voucherCount: number;
    checkoutRedirect: string;
  };
};
