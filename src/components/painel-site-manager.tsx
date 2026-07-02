"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { PainelModal } from "@/components/painel-modal";
import type {
  ManagedAttraction,
  ManagedEvent,
  ManagedHomeImage,
  RincaoContentData,
} from "@/lib/rincao-content-store";

type EditableItem =
  | { section: "home"; item: ManagedHomeImage | null }
  | { section: "attraction"; item: ManagedAttraction | null }
  | { section: "event"; item: ManagedEvent | null };

type DeleteTarget = {
  section: "home" | "attraction" | "event";
  id: string;
  title: string;
};

type EventMode = "date" | "link";
type HomeHeroMode = "with-link" | "without-link";

type EventDatePayload = {
  agenda?: {
    priceTableId?: number | null;
    informationId?: number | null;
  } | null;
};

const colors = {
  ink: "text-[#123b63]",
  muted: "text-[#60758d]",
  softText: "text-[#6f86a0]",
  border: "border-[#d4dfeb]",
  softBorder: "border-[#b9cde0]",
  softBg: "bg-[#eef4fb]",
  buttonBg: "bg-[#123b63]",
  buttonBgHover: "bg-[#0f2f4f]",
  buttonBorder: "border-[#123b63]",
};

function itemTitle(item: EditableItem) {
  if (item.section === "home") {
    return item.item ? "Editar imagem da hero" : "Adicionar imagem da hero";
  }

  if (item.section === "attraction") {
    return item.item ? "Editar atração" : "Adicionar atração";
  }

  return item.item ? "Editar evento" : "Adicionar evento";
}

function resolveEventMode(event: ManagedEvent | null | undefined): EventMode {
  const href = event?.href?.trim() ?? "";

  return /(?:\?|&)date=\d{4}-\d{2}-\d{2}(?:&|$)/.test(href) ? "date" : "link";
}

function resolveEventDate(event: ManagedEvent | null | undefined) {
  const href = event?.href?.trim() ?? "";
  const match = href.match(/(?:\?|&)date=(\d{4}-\d{2}-\d{2})(?:&|$)/);

  return match?.[1] ?? "";
}

function resolveHomeHeroMode(item: ManagedHomeImage | null | undefined): HomeHeroMode {
  return item?.href?.trim() ? "with-link" : "without-link";
}

function ImagePicker({ name, label }: { name: string; label: string }) {
  return (
    <label className={`grid gap-2 text-sm font-semibold ${colors.ink}`}>
      {label}
      <input
        name={name}
        type="file"
        accept="image/*"
        className={`rounded-[8px] border border-dashed ${colors.softBorder} bg-white px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-[#123b63] file:px-4 file:py-2 file:text-sm file:font-black file:text-white`}
      />
      <span className={`text-xs font-medium ${colors.softText}`}>
        Clique em escolher arquivo para enviar a imagem.
        {name === "mobileImage"
          ? " Se não enviar a versão mobile, a imagem desktop será usada no celular."
          : ""}
      </span>
    </label>
  );
}

function CurrentImagePreview({
  label,
  src,
  alt,
}: {
  label: string;
  src: string;
  alt: string;
}) {
  return (
    <div className="grid gap-2">
      <p className={`text-sm font-semibold ${colors.ink}`}>{label}</p>
      <div className={`overflow-hidden rounded-[8px] border ${colors.border} ${colors.softBg}`}>
        <img
          src={src}
          alt={alt}
          className="block h-40 w-full object-cover"
          loading="lazy"
        />
      </div>
      <p className={`text-xs font-medium ${colors.softText}`}>
        O navegador não reabre esse campo com um arquivo já selecionado. Para trocar
        a imagem, escolha um novo arquivo abaixo.
      </p>
    </div>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      disabled={pending}
      className={`rounded-full ${colors.buttonBg} px-5 py-3 text-sm font-black text-white disabled:opacity-60`}
    >
      {pending ? "Salvando..." : "Salvar"}
    </button>
  );
}

function MoveButtons({
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  busy,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  busy: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp || busy}
        aria-label="Mover para cima"
        className={`rounded-full border ${colors.border} px-3 py-2 text-xs font-black ${colors.ink} disabled:cursor-not-allowed disabled:opacity-45`}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown || busy}
        aria-label="Mover para baixo"
        className={`rounded-full border ${colors.border} px-3 py-2 text-xs font-black ${colors.ink} disabled:cursor-not-allowed disabled:opacity-45`}
      >
        ↓
      </button>
    </div>
  );
}

export function PainelSiteManager({
  content,
  initialEditEventId = null,
  initialOpenCreateEvent = false,
  defaultPriceTableId,
  defaultInformationId,
}: {
  content: RincaoContentData;
  initialEditEventId?: string | null;
  initialOpenCreateEvent?: boolean;
  defaultPriceTableId?: number | null;
  defaultInformationId?: number | null;
}) {
  const router = useRouter();
  const initialEditing = (() => {
    if (initialEditEventId) {
      const item = content.events.find((event) => event.id === initialEditEventId) ?? null;

      if (item) {
        return { section: "event", item } satisfies EditableItem;
      }
    }

    if (initialOpenCreateEvent) {
      return { section: "event", item: null } satisfies EditableItem;
    }

    return null;
  })();
  const initialEventItem =
    initialEditing?.section === "event"
      ? (initialEditing.item as ManagedEvent | null)
      : null;
  const initialEventMode = initialEventItem ? resolveEventMode(initialEventItem) : "date";
  const [editing, setEditing] = useState<EditableItem | null>(initialEditing);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pending, setPending] = useState(false);
  const [movingKey, setMovingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventMode, setEventMode] = useState<EventMode>(initialEventMode);
  const [eventDateValue, setEventDateValue] = useState(
    resolveEventDate(initialEventItem),
  );
  const [eventHrefValue, setEventHrefValue] = useState(
    initialEventItem && initialEventMode === "link" ? initialEventItem.href ?? "" : "",
  );
  const [eventPriceTableId, setEventPriceTableId] = useState<number | null>(
    defaultPriceTableId ?? null,
  );
  const [eventInformationId, setEventInformationId] = useState<number | null>(
    defaultInformationId ?? null,
  );
  const [eventAvailabilityLoading, setEventAvailabilityLoading] = useState(false);
  const [homeHeroMode, setHomeHeroMode] = useState<HomeHeroMode>("without-link");
  const [homeHeroHrefValue, setHomeHeroHrefValue] = useState("");
  const currentEvent =
    editing?.section === "event" ? (editing.item as ManagedEvent | null) : null;

  useEffect(() => {
    if (editing?.section !== "event" || eventMode !== "date" || !eventDateValue) {
      return;
    }

    const controller = new AbortController();

    async function loadEventDateDetails() {
      setEventAvailabilityLoading(true);

      try {
        const response = await fetch(
          `/api/painel/agenda?date=${encodeURIComponent(eventDateValue)}`,
          {
            signal: controller.signal,
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: EventDatePayload; error?: { message?: string } }
          | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Não foi possível carregar a data.");
        }

        setEventPriceTableId(
          payload.data?.agenda?.priceTableId ?? defaultPriceTableId ?? null,
        );
        setEventInformationId(
          payload.data?.agenda?.informationId ?? defaultInformationId ?? null,
        );
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setEventPriceTableId(defaultPriceTableId ?? null);
        setEventInformationId(defaultInformationId ?? null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar a data do evento.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setEventAvailabilityLoading(false);
        }
      }
    }

    void loadEventDateDetails();

    return () => controller.abort();
  }, [
    defaultInformationId,
    defaultPriceTableId,
    editing,
    eventDateValue,
    eventMode,
  ]);

  function openCreateEvent() {
    setEditing({ section: "event", item: null });
    setEventMode("date");
    setEventDateValue("");
    setEventHrefValue("");
    setEventPriceTableId(defaultPriceTableId ?? null);
    setEventInformationId(defaultInformationId ?? null);
    setError(null);
  }

  function openCreateHome() {
    setEditing({ section: "home", item: null });
    setHomeHeroMode("without-link");
    setHomeHeroHrefValue("");
    setError(null);
  }

  function openEditHome(item: ManagedHomeImage) {
    setEditing({ section: "home", item });
    setHomeHeroMode(resolveHomeHeroMode(item));
    setHomeHeroHrefValue(item.href ?? "");
    setError(null);
  }

  function openEditEvent(item: ManagedEvent) {
    const nextMode = resolveEventMode(item);

    setEditing({ section: "event", item });
    setEventMode(nextMode);
    setEventDateValue(resolveEventDate(item));
    setEventHrefValue(nextMode === "link" ? item.href ?? "" : "");
    setEventPriceTableId(defaultPriceTableId ?? null);
    setEventInformationId(defaultInformationId ?? null);
    setError(null);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);

      if (editing?.section === "event") {
        formData.set("eventMode", eventMode);
        formData.set("eventDate", eventDateValue);
        formData.set("href", eventHrefValue);

        if (eventPriceTableId) {
          formData.set("priceTableId", String(eventPriceTableId));
        }

        if (eventInformationId) {
          formData.set("informationId", String(eventInformationId));
        }
      }

      if (editing?.section === "home") {
        if (homeHeroMode === "with-link" && !homeHeroHrefValue.trim()) {
          throw new Error("Informe o link da hero.");
        }

        formData.set("href", homeHeroMode === "with-link" ? homeHeroHrefValue : "");
      }

      const response = await fetch("/api/painel/site-content", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Não foi possível salvar.");
      }

      setEditing(null);
      router.replace("/painel/site");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Não foi possível salvar.",
      );
    } finally {
      setPending(false);
    }
  }

  async function moveItem(
    section: "home" | "attraction" | "event",
    id: string,
    direction: "up" | "down",
  ) {
    const key = `${section}:${id}:${direction}`;
    setMovingKey(key);
    setError(null);

    try {
      const response = await fetch("/api/painel/site-content", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section, id, direction }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Não foi possível mover o item.");
      }

      router.refresh();
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Não foi possível mover o item.",
      );
    } finally {
      setMovingKey(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/painel/site-content", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(deleteTarget),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message || "Não foi possível excluir.");
      }

      setDeleteTarget(null);
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível excluir.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="panel-section p-5">
        <p className="panel-eyebrow !text-[#4d7398]">Imagens da hero</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <h3 className={`text-[24px] font-black ${colors.ink}`}>Banners publicados</h3>
          <button
            type="button"
            onClick={openCreateHome}
            className={`rounded-full ${colors.buttonBg} px-5 py-3 text-sm font-black text-white`}
          >
            Adicionar imagem
          </button>
        </div>
        <div className="mt-5 flex gap-4 overflow-x-auto pb-3">
          {content.homeImages.map((item, index) => (
            <article
              key={item.id}
              className={`min-w-[320px] rounded-[8px] border ${colors.border} bg-white p-4`}
            >
              <div className={`h-36 overflow-hidden rounded-[8px] ${colors.softBg}`}>
                <img
                  src={item.desktopSrc}
                  alt={item.alt}
                  className="block h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <h4 className={`text-lg font-black ${colors.ink}`}>{item.alt}</h4>
                  <p className={`text-sm ${colors.muted}`}>
                    {item.active ? "Publicado" : "Oculto"}
                  </p>
                  <p className={`text-xs ${colors.softText}`}>
                    {item.href?.trim() ? "Com link" : "Sem link"}
                  </p>
                </div>
                <span
                  className={`rounded-full ${colors.softBg} px-3 py-1 text-xs font-black text-[#28527e]`}
                >
                  #{item.sortOrder}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <MoveButtons
                  onMoveUp={() => moveItem("home", item.id, "up")}
                  onMoveDown={() => moveItem("home", item.id, "down")}
                  canMoveUp={index > 0}
                  canMoveDown={index < content.homeImages.length - 1}
                  busy={movingKey?.startsWith(`home:${item.id}:`) ?? false}
                />
                <button
                  type="button"
                  onClick={() => openEditHome(item)}
                  className={`rounded-full border ${colors.border} px-4 py-2 text-xs font-black ${colors.ink}`}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget({
                      section: "home",
                      id: item.id,
                      title: item.alt,
                    })
                  }
                  className="rounded-full border border-[#f0c3bc] px-4 py-2 text-xs font-black text-[#a33b31]"
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ContentList
          section="attraction"
          title="Atrações"
          buttonLabel="Adicionar atração"
          items={content.attractions}
          movingKey={movingKey}
          onEdit={(item) => setEditing({ section: "attraction", item })}
          onCreate={() => setEditing({ section: "attraction", item: null })}
          onDelete={(item) =>
            setDeleteTarget({
              section: "attraction",
              id: item.id,
              title: item.title,
            })
          }
          onMove={(id, direction) => moveItem("attraction", id, direction)}
        />
        <ContentList
          section="event"
          title="Eventos"
          buttonLabel="Adicionar evento"
          items={content.events}
          movingKey={movingKey}
          onEdit={openEditEvent}
          onCreate={openCreateEvent}
          onDelete={(item) =>
            setDeleteTarget({ section: "event", id: item.id, title: item.title })
          }
          onMove={(id, direction) => moveItem("event", id, direction)}
        />
      </section>

      <PainelModal
        title={editing ? itemTitle(editing) : ""}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <form onSubmit={submitForm} className="grid gap-4">
            <input type="hidden" name="section" value={editing.section} />
            {editing.item ? <input type="hidden" name="id" value={editing.item.id} /> : null}
            {editing.section === "home" ? (
              <>
                <Field label="Texto da imagem">
                  <input
                    name="alt"
                    defaultValue={editing.item?.alt ?? ""}
                    className={`rounded-[8px] border ${colors.border} px-4 py-3`}
                  />
                </Field>
                <div className={`grid gap-3 rounded-[10px] border ${colors.border} bg-[#f8fbff] p-4`}>
                  <div>
                    <p className={`text-sm font-black ${colors.ink}`}>Link da hero</p>
                    <p className={`mt-1 text-xs leading-5 ${colors.muted}`}>
                      Defina se essa imagem da hero pode ser clicada na home.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setHomeHeroMode("with-link")}
                      className={`rounded-[8px] border px-4 py-3 text-sm font-black ${
                        homeHeroMode === "with-link"
                          ? `${colors.buttonBorder} ${colors.buttonBg} text-white`
                          : `${colors.border} bg-white ${colors.ink}`
                      }`}
                    >
                      Com link
                    </button>
                    <button
                      type="button"
                      onClick={() => setHomeHeroMode("without-link")}
                      className={`rounded-[8px] border px-4 py-3 text-sm font-black ${
                        homeHeroMode === "without-link"
                          ? `${colors.buttonBorder} ${colors.buttonBg} text-white`
                          : `${colors.border} bg-white ${colors.ink}`
                      }`}
                    >
                      Sem link
                    </button>
                  </div>
                </div>
                {homeHeroMode === "with-link" ? (
                  <Field label="Link da hero">
                    <input
                      name="hrefVisible"
                      value={homeHeroHrefValue}
                      onChange={(event) => setHomeHeroHrefValue(event.target.value)}
                      placeholder="https://site.com.br ou /pagina"
                      className={`rounded-[8px] border ${colors.border} px-4 py-3`}
                    />
                  </Field>
                ) : null}
                {editing.item ? (
                  <>
                    <CurrentImagePreview
                      label="Imagem desktop atual"
                      src={editing.item.desktopSrc}
                      alt={editing.item.alt}
                    />
                    <CurrentImagePreview
                      label="Imagem mobile atual"
                      src={editing.item.mobileSrc}
                      alt={editing.item.alt}
                    />
                  </>
                ) : null}
                <ImagePicker name="desktopImage" label="Imagem desktop" />
                <ImagePicker name="mobileImage" label="Imagem mobile" />
              </>
            ) : (
              <>
                {editing.section === "event" ? (
                  <div className={`grid gap-3 rounded-[10px] border ${colors.border} bg-[#f8fbff] p-4`}>
                    <div>
                      <p className={`text-sm font-black ${colors.ink}`}>Tipo do evento</p>
                      <p className={`mt-1 text-xs leading-5 ${colors.muted}`}>
                        Escolha se o botão vai abrir uma data promocional da agenda ou um
                        link externo.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setEventMode("date")}
                        className={`rounded-[8px] border px-4 py-3 text-sm font-black ${
                          eventMode === "date"
                            ? `${colors.buttonBorder} ${colors.buttonBg} text-white`
                            : `${colors.border} bg-white ${colors.ink}`
                        }`}
                      >
                        Data
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventMode("link")}
                        className={`rounded-[8px] border px-4 py-3 text-sm font-black ${
                          eventMode === "link"
                            ? `${colors.buttonBorder} ${colors.buttonBg} text-white`
                            : `${colors.border} bg-white ${colors.ink}`
                        }`}
                      >
                        Link externo
                      </button>
                    </div>
                  </div>
                ) : null}

                <Field label="Título">
                  <input
                    name="title"
                    defaultValue={editing.item?.title ?? ""}
                    className={`rounded-[8px] border ${colors.border} px-4 py-3`}
                  />
                </Field>

                <Field label="Descrição">
                  <textarea
                    name="description"
                    defaultValue={editing.item?.description ?? ""}
                    rows={4}
                    className={`rounded-[8px] border ${colors.border} px-4 py-3`}
                  />
                </Field>

                {editing.section === "event" ? (
                  <>
                    {eventMode === "date" ? (
                      <>
                        <Field label="Data do evento">
                          <input
                            name="eventDateVisible"
                            type="date"
                            value={eventDateValue}
                            onChange={(event) => setEventDateValue(event.target.value)}
                            className={`rounded-[8px] border ${colors.border} px-4 py-3`}
                          />
                        </Field>

                        {eventAvailabilityLoading ? (
                          <p className={`rounded-[8px] border ${colors.border} bg-white px-4 py-3 text-sm ${colors.muted}`}>
                            Carregando dados da data...
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <Field label="Link externo">
                        <input
                          name="hrefVisible"
                          value={eventHrefValue}
                          onChange={(event) => setEventHrefValue(event.target.value)}
                          placeholder="https://site.com.br ou /agenda"
                          className={`rounded-[8px] border ${colors.border} px-4 py-3`}
                        />
                      </Field>
                    )}

                    <Field label="Texto do botão">
                      <input
                        name="buttonLabel"
                        defaultValue={currentEvent?.buttonLabel ?? "Compre seu ingresso!"}
                        className={`rounded-[8px] border ${colors.border} px-4 py-3`}
                      />
                    </Field>
                  </>
                ) : null}

                {editing.item?.imageSrc ? (
                  <CurrentImagePreview
                    label="Imagem atual"
                    src={editing.item.imageSrc}
                    alt={editing.item.title}
                  />
                ) : null}
                <ImagePicker name="image" label="Imagem" />
              </>
            )}

            <label className={`flex items-center gap-2 text-sm font-black ${colors.ink}`}>
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing.item?.active ?? true}
              />{" "}
              Publicar
            </label>

            {error ? (
              <p className="rounded-[8px] border border-[#f1b1aa] bg-[#fff4f2] px-4 py-3 text-sm text-[#9d3d31]">
                {error}
              </p>
            ) : null}
            <SubmitButton pending={pending} />
          </form>
        ) : null}
      </PainelModal>

      <PainelModal
        title="Confirmar exclusão"
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      >
        <p className={`text-sm leading-7 ${colors.muted}`}>
          Tem certeza que deseja excluir <strong>{deleteTarget?.title}</strong>?
        </p>
        {error ? (
          <p className="mt-3 rounded-[8px] border border-[#f1b1aa] bg-[#fff4f2] px-4 py-3 text-sm text-[#9d3d31]">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={confirmDelete}
            disabled={pending}
            className="rounded-full bg-[#b24239] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {pending ? "Excluindo..." : "Excluir"}
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className={`rounded-full border ${colors.border} px-5 py-3 text-sm font-black ${colors.ink}`}
          >
            Cancelar
          </button>
        </div>
      </PainelModal>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={`grid gap-2 text-sm font-semibold ${colors.ink}`}>
      {label}
      {children}
    </label>
  );
}

function ContentList<T extends ManagedAttraction | ManagedEvent>({
  section,
  title,
  buttonLabel,
  items,
  movingKey,
  onEdit,
  onCreate,
  onDelete,
  onMove,
}: {
  section: "attraction" | "event";
  title: string;
  buttonLabel: string | null;
  items: T[];
  movingKey: string | null;
  onEdit: (item: T) => void;
  onCreate: () => void;
  onDelete: (item: T) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}) {
  return (
    <article className="panel-section p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="panel-eyebrow !text-[#4d7398]">{title}</p>
        {buttonLabel ? (
          <button
            type="button"
            onClick={onCreate}
            className={`rounded-full ${colors.buttonBg} px-5 py-3 text-sm font-black text-white`}
          >
            {buttonLabel}
          </button>
        ) : null}
      </div>
      <div className="mt-5 grid max-h-[520px] gap-3 overflow-y-auto pr-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`rounded-[10px] border ${colors.border} bg-white p-4`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-lg font-black ${colors.ink}`}>{item.title}</p>
                <p className={`mt-2 text-sm leading-6 ${colors.muted}`}>{item.description}</p>
              </div>
              <span
                className={`rounded-full ${colors.softBg} px-3 py-1 text-xs font-black text-[#28527e]`}
              >
                #{item.sortOrder}
              </span>
            </div>
            {"buttonLabel" in item ? (
              <div className={`mt-3 flex flex-wrap gap-2 text-xs font-semibold ${colors.ink}`}>
                <span className={`rounded-full border ${colors.border} px-3 py-1`}>
                  Botão: {item.buttonLabel}
                </span>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <MoveButtons
                onMoveUp={() => onMove(item.id, "up")}
                onMoveDown={() => onMove(item.id, "down")}
                canMoveUp={index > 0}
                canMoveDown={index < items.length - 1}
                busy={movingKey?.startsWith(`${section}:${item.id}:`) ?? false}
              />
              <button
                type="button"
                onClick={() => onEdit(item)}
                className={`rounded-full border ${colors.border} px-4 py-2 text-xs font-black ${colors.ink}`}
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onDelete(item)}
                className="rounded-full border border-[#f0c3bc] px-4 py-2 text-xs font-black text-[#a33b31]"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
