import type { PoolClient } from "pg";

export type GatewayPurchaseStatus = "conc" | "pend" | "canc" | "unknown";

export type PaymentReconciliationRecord = {
  purchaseId: number;
  gatewayPaymentId: string;
  reference: string;
  status: number;
  purchaseStatus: GatewayPurchaseStatus;
  date: Date;
  lastEventDate: Date;
  paymentMethodType: number;
  paymentMethodCode: number;
  grossAmount: string;
  discountAmount: string;
  feeAmount: string;
  netAmount: string;
  extraAmount: string;
  installmentCount: number;
  senderEmail: string;
  senderName: string;
  senderPhoneAreaCode: string | null;
  senderPhoneNumber: string | null;
  shippingType: number;
  shippingCost: string;
  shippingAddressStreet: string;
  shippingAddressNumber: string;
  shippingAddressDistrict: string;
  shippingAddressCity: string;
  shippingAddressState: string;
  shippingAddressCountry: string;
  shippingAddressPostalCode: string;
  xml: string;
};

export type QueryClient = Pick<PoolClient, "query">;

export type PaymentReconciliationApplyResult = {
  purchaseId: number;
  gatewayPaymentId: string;
  gatewayStatus: number;
  purchaseStatus: GatewayPurchaseStatus;
  ledgerAction: "inserted" | "updated" | "unchanged";
};
