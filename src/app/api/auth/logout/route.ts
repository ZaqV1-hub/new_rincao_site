import { NextResponse } from "next/server";
import type { AuthLogoutResponse } from "@/lib/auth-contracts";
import { clearAuthCookie } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json<AuthLogoutResponse>({ ok: true });
  clearAuthCookie(response);

  return response;
}
