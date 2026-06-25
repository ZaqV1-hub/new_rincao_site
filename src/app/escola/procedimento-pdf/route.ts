import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL("/legacy/Procedimento_Compra_Ingresso_Escola.pdf", request.url);

  return NextResponse.redirect(url);
}
