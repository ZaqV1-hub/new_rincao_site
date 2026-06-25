import { NextResponse } from "next/server";
import { proxyCheckoutNotification } from "@/lib/checkout-notification-proxy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const proxied = await proxyCheckoutNotification(request);

    return new NextResponse(proxied.body, {
      status: proxied.status,
      headers: {
        "content-type": proxied.contentType,
      },
    });
  } catch (error) {
    console.error("checkout-notification-proxy-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "checkout_notification_unavailable",
          message: "Nao foi possivel processar a notificacao agora.",
        },
      },
      { status: 502 },
    );
  }
}
