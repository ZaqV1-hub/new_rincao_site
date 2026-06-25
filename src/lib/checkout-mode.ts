import { isCieloEcommerceConfigured } from "@/lib/cielo-ecommerce";

export type CheckoutMode = "widget" | "mock" | "unavailable";

export function resolveCheckoutMode(): CheckoutMode {
  if (isNativeCheckoutConfigured()) {
    return "widget";
  }

  if (isLocalCheckoutMockEnabled()) {
    return "mock";
  }

  return "unavailable";
}

export function isNativeCheckoutConfigured() {
  return isCieloEcommerceConfigured();
}

export function isLocalCheckoutMockEnabled() {
  return process.env.NODE_ENV !== "production";
}
