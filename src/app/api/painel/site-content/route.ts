import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authorizePainelApiAccess } from "@/lib/painel-api-auth";
import {
  asPainelAgendaError,
  deletePainelAgenda,
  getPainelAgendaDay,
  listPainelAgendaInformationOptions,
  listPainelAgendaPriceTables,
  upsertPainelAgendaRange,
} from "@/lib/painel-agenda";
import {
  moveOrderedItem,
  removeOrderedItem,
  upsertOrderedItem,
} from "@/lib/managed-content-order";
import { authenticateOperationsRequest } from "@/lib/ops-auth";
import {
  makeContentId,
  readRincaoContent,
  saveUploadedSiteImage,
  writeRincaoContent,
} from "@/lib/rincao-content-store";

export const runtime = "nodejs";

function asText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().normalize("NFC");
}

function asBool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { message } }, { status });
}

function handleRouteError(error: unknown) {
  const agendaError = asPainelAgendaError(error);

  if (agendaError.code !== "agenda_unknown_error") {
    return errorResponse(agendaError.message, agendaError.status);
  }

  return errorResponse(
    error instanceof Error && error.message.trim()
      ? error.message
      : "Não foi possível concluir a operação.",
    500,
  );
}

async function authorize(request: Request) {
  const auth = authenticateOperationsRequest(request, {
    requiredPermission: "ops.read",
  });

  if (!auth.ok) {
    return auth.response;
  }

  const painelAuth = await authorizePainelApiAccess(request, [
    "vis_info",
    "vis_param",
  ]);
  return painelAuth.ok ? null : painelAuth.response;
}

function revalidateSite() {
  revalidatePath("/");
  revalidatePath("/painel/site");
  revalidatePath("/painel/eventos");
  revalidatePath("/painel/agenda");
}

function resolveEventDateFromHref(href: string | undefined) {
  const normalized = String(href ?? "").trim();
  const match = normalized.match(/(?:\?|&)date=(\d{4}-\d{2}-\d{2})(?:&|$)/);

  return match?.[1] ?? null;
}

async function deletePromotionalAgendaByDate(date: string | null, reason: string) {
  if (!date) {
    return;
  }

  const agendaDay = await getPainelAgendaDay(date);

  if (agendaDay.agenda?.type !== "promo") {
    return;
  }

  await deletePainelAgenda(agendaDay.agenda.id, { reason });
}

export async function POST(request: Request) {
  try {
    const authResponse = await authorize(request);

    if (authResponse) {
      return authResponse;
    }

    const formData = await request.formData();
    const section = asText(formData.get("section"));
    const data = await readRincaoContent();

    if (section === "home") {
      const id =
        asText(formData.get("id")) || makeContentId(asText(formData.get("alt")));
      const current = data.homeImages.find((item) => item.id === id);
      const desktopUpload = await saveUploadedSiteImage(formData.get("desktopImage"));
      const mobileUpload = await saveUploadedSiteImage(formData.get("mobileImage"));

      if (!desktopUpload && !mobileUpload && !current?.desktopSrc && !current?.mobileSrc) {
        return errorResponse("Envie pelo menos uma imagem para o banner da hero.");
      }

      const desktopSrc =
        desktopUpload ??
        current?.desktopSrc ??
        mobileUpload ??
        current?.mobileSrc ??
        "";
      const mobileSrc =
        mobileUpload ??
        current?.mobileSrc ??
        desktopUpload ??
        current?.desktopSrc ??
        "";

      await writeRincaoContent({
        ...data,
        homeImages: upsertOrderedItem(data.homeImages, {
          id,
          desktopSrc,
          mobileSrc,
          alt: asText(formData.get("alt")) || current?.alt || "Imagem da hero",
          active: asBool(formData.get("active")),
          sortOrder: current?.sortOrder ?? data.homeImages.length + 1,
        }),
      });
      revalidateSite();
      return NextResponse.json({ ok: true });
    }

    if (section === "attraction") {
      const title = asText(formData.get("title"));
      const id = asText(formData.get("id")) || makeContentId(title);
      const current = data.attractions.find((item) => item.id === id);
      const imageUpload = await saveUploadedSiteImage(formData.get("image"));

      if (!imageUpload && !current?.imageSrc) {
        return errorResponse("Envie uma imagem para a atração.");
      }

      await writeRincaoContent({
        ...data,
        attractions: upsertOrderedItem(data.attractions, {
          id,
          title: title || current?.title || "Nova atração",
          description:
            asText(formData.get("description")) || current?.description || "",
          imageSrc: imageUpload ?? current?.imageSrc ?? "",
          active: asBool(formData.get("active")),
          sortOrder: current?.sortOrder ?? data.attractions.length + 1,
        }),
      });
      revalidateSite();
      return NextResponse.json({ ok: true });
    }

    if (section === "event") {
      const title = asText(formData.get("title"));
      const id = asText(formData.get("id")) || makeContentId(title);
      const current = data.events.find((item) => item.id === id);
      const imageUpload = await saveUploadedSiteImage(formData.get("image"));
      const hasDate = asText(formData.get("eventMode")) === "date";
      const eventDate = asText(formData.get("eventDate"));
      const passportIds = formData
        .getAll("passportIds")
        .map((item) => String(item).trim())
        .filter(Boolean);
      const addonIds = formData
        .getAll("addonIds")
        .map((item) => String(item).trim())
        .filter(Boolean);
      const [priceTables, informationOptions] = await Promise.all([
        listPainelAgendaPriceTables(),
        listPainelAgendaInformationOptions(),
      ]);
      const currentEventDate = resolveEventDateFromHref(current?.href);
      const currentAgendaDay = currentEventDate
        ? await getPainelAgendaDay(currentEventDate)
        : null;
      const targetAgendaDay =
        hasDate && eventDate ? await getPainelAgendaDay(eventDate) : null;
      const priceTableId =
        Number(formData.get("priceTableId")) ||
        targetAgendaDay?.agenda?.priceTableId ||
        currentAgendaDay?.agenda?.priceTableId ||
        priceTables[0]?.id ||
        0;
      const informationId =
        Number(formData.get("informationId")) ||
        targetAgendaDay?.agenda?.informationId ||
        currentAgendaDay?.agenda?.informationId ||
        informationOptions[0]?.id ||
        0;

      if (hasDate && !eventDate) {
        return errorResponse("Informe a data promocional do evento.");
      }

      if (!hasDate && !asText(formData.get("href")) && !current?.href) {
        return errorResponse("Informe o link manual do botão.");
      }

      if (!imageUpload && !current?.imageSrc) {
        return errorResponse("Envie uma imagem para o evento.");
      }

      const derivedHref =
        hasDate && eventDate
          ? `/agenda?mes=${Number(eventDate.slice(5, 7))}&ano=${eventDate.slice(0, 4)}&date=${eventDate}`
          : "";

      if (hasDate) {
        if (currentEventDate && currentEventDate !== eventDate) {
          await deletePromotionalAgendaByDate(
            currentEventDate,
            "Evento do site movido para outra data promocional.",
          );
        }

        await upsertPainelAgendaRange({
          agendaId: targetAgendaDay?.agenda?.id ?? null,
          startDate: eventDate,
          endDate: eventDate,
          priceTableId,
          informationId,
          type: "promo",
          status: targetAgendaDay?.agenda?.status ?? "abe",
          promotionName: title || current?.title || "Novo evento",
          promotionDescription:
            asText(formData.get("description")) || current?.description || "",
          passportIds,
          addonIds,
          confirmOverwrite: true,
          reason: "Evento do site atualizado pelo painel",
        });
      } else if (currentEventDate) {
        await deletePromotionalAgendaByDate(
          currentEventDate,
          "Evento do site alterado para link externo.",
        );
      }

      await writeRincaoContent({
        ...data,
        events: upsertOrderedItem(data.events, {
          id,
          title: title || current?.title || "Novo evento",
          description:
            asText(formData.get("description")) || current?.description || "",
          imageSrc: imageUpload ?? current?.imageSrc ?? "",
          href: derivedHref || asText(formData.get("href")) || current?.href || "/agenda",
          buttonLabel:
            asText(formData.get("buttonLabel")) ||
            current?.buttonLabel ||
            "Compre seu ingresso!",
          active: asBool(formData.get("active")),
          sortOrder: current?.sortOrder ?? data.events.length + 1,
        }),
      });
      revalidateSite();
      return NextResponse.json({ ok: true });
    }

    return errorResponse("Tipo de conteúdo inválido.");
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const authResponse = await authorize(request);

    if (authResponse) {
      return authResponse;
    }

    const payload = (await request.json().catch(() => null)) as {
      section?: string;
      id?: string;
    } | null;
    const data = await readRincaoContent();

    if (!payload?.id) {
      return errorResponse("Item não informado.");
    }

    if (payload.section === "home") {
      await writeRincaoContent({
        ...data,
        homeImages: removeOrderedItem(data.homeImages, payload.id),
      });
    } else if (payload.section === "attraction") {
      await writeRincaoContent({
        ...data,
        attractions: removeOrderedItem(data.attractions, payload.id),
      });
    } else if (payload.section === "event") {
      const current = data.events.find((item) => item.id === payload.id);

      await deletePromotionalAgendaByDate(
        resolveEventDateFromHref(current?.href),
        "Evento do site removido pelo painel.",
      );

      await writeRincaoContent({
        ...data,
        events: removeOrderedItem(data.events, payload.id),
      });
    } else {
      return errorResponse("Tipo de conteúdo inválido.");
    }

    revalidateSite();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const authResponse = await authorize(request);

    if (authResponse) {
      return authResponse;
    }

    const payload = (await request.json().catch(() => null)) as {
      section?: string;
      id?: string;
      direction?: "up" | "down";
    } | null;
    const data = await readRincaoContent();

    if (!payload?.id || (payload.direction !== "up" && payload.direction !== "down")) {
      return errorResponse("Movimentação inválida.");
    }

    if (payload.section === "home") {
      await writeRincaoContent({
        ...data,
        homeImages: moveOrderedItem(data.homeImages, payload.id, payload.direction),
      });
    } else if (payload.section === "attraction") {
      await writeRincaoContent({
        ...data,
        attractions: moveOrderedItem(
          data.attractions,
          payload.id,
          payload.direction,
        ),
      });
    } else if (payload.section === "event") {
      await writeRincaoContent({
        ...data,
        events: moveOrderedItem(data.events, payload.id, payload.direction),
      });
    } else {
      return errorResponse("Tipo de conteúdo inválido.");
    }

    revalidateSite();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
