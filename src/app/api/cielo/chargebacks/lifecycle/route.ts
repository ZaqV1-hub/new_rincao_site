import { handleChargebackWebhook } from "@/lib/chargeback-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleChargebackWebhook(request, "lifecycle");
}
