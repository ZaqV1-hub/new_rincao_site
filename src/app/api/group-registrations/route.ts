import { NextResponse } from "next/server";
import { getRegistrationPage } from "@/lib/group-registration-content";
import {
  buildRegistrationWhatsappMessage,
  sanitizeRegistrationInput,
  validateRegistrationInput,
} from "@/lib/group-registration-form-data";
import { storeRegistrationSubmission } from "@/lib/group-registration-storage";
import { contact } from "@/lib/site-content";

export const runtime = "nodejs";

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;

    if (typeof payload.website === "string" && payload.website.trim()) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const input = sanitizeRegistrationInput(payload);

    try {
      getRegistrationPage(input.slug);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Pagina de cadastro invalida." },
        { status: 400 },
      );
    }

    const validation = validateRegistrationInput(input);

    if (!validation.valid) {
      return NextResponse.json(
        {
          ok: false,
          error: validation.emailIsValid
            ? "Preencha os campos obrigatorios."
            : "Informe um e-mail valido.",
          missingFields: validation.missingFields,
        },
        { status: 400 },
      );
    }

    const submission = await storeRegistrationSubmission(input, {
      ip: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    const whatsappNumber = contact.whatsapp.replace("https://wa.me/", "");
    const whatsappText = buildRegistrationWhatsappMessage(input, submission.protocol);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`;

    return NextResponse.json({
      ok: true,
      protocol: submission.protocol,
      createdAt: submission.createdAt,
      storage: submission.storage,
      whatsappUrl,
    });
  } catch (error) {
    console.error("group-registration-submit-failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Nao foi possivel registrar sua solicitacao agora.",
      },
      { status: 500 },
    );
  }
}
