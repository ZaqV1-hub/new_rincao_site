"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { PainelModal } from "@/components/painel-modal";
import type {
  EstanciaContentData,
  ManagedAttraction,
  ManagedEvent,
  ManagedHomeImage,
} from "@/lib/estancia-content-store";

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

type EventDatePayload = {
  agenda?: {
    priceTableId?: number | null;
    informationId?: number | null;
  } | null;
  selectedPassportIds?: string[];
  selectedAddonIds?: string[];
};

function itemTitle(item: EditableItem) {
  if (item.section === "home") {
    return item.item ? "Editar imagem da home" : "Adicionar imagem da home";
  }

  if (item.section === "attraction") {
    return item.item ? "Editar atracao" : "Adicionar atracao";
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

function ImagePicker({ name, label }: { name: string; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#17351f]">
      {label}
      <input
        name={name}
        type="file"
        accept="image/*"
        className="rounded-[8px] border border-dashed border-[#9bbd91] bg-white px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-[#17342d] file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
      />
      <span className="text-xs font-medium text-[#6a806e]">
        Clique em escolher arquivo para enviar a imagem.
        {name === "mobileImage"
          ? " Se nao enviar a versao mobile, a imagem desktop sera usada no celular."
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
      <p className="text-sm font-semibold text-[#17351f]">{label}</p>
      <div className="overflow-hidden rounded-[8px] border border-[#dbe7d7] bg-[#eef3e8]">
        <img
          src={src}
          alt={alt}
          className="block h-40 w-full object-cover"
          loading="lazy"
        />
      </div>
      <p className="text-xs font-medium text-[#6a806e]">
        O navegador nao reabre esse campo com um arquivo ja selecionado. Para trocar
        a imagem, escolha um novo arquivo abaixo.
      </p>
    </div>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      disabled={pending}
      className="rounded-full bg-[#17342d] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
    >
      {pending ? "Salvando..." : "Salvar"}
    </button>
  );
}

export function PainelSiteManager({
  content,
  initialEditEventId = null,
  initialOpenCreateEvent = false,
  defaultPriceTableId,
  defaultInformationId,
}: {
  content: EstanciaContentData;
  initialEditEventId?: string | null;
  initialOpenCreateEvent?: boolean;
  defaultPriceTableId?: number | null;
  defaultInformationId?: number | null;
}) {
  const router = useRouter();
  const passports = useMemo(
    () => content.products.filter((product) => product.type === "passport"),
    [content.products],
  );
  const addons = useMemo(
    () => content.products.filter((product) => product.type === "addon"),
    [content.products],
  );
  const defaultPassportIds = useMemo(
    () => passports.map((product) => product.id),
    [passports],
  );
  const defaultAddonIds = useMemo(
    () => addons.map((product) => product.id),
    [addons],
  );
  const [editing, setEditing] = useState<EditableItem | null>(() => {
    if (initialEditEventId) {
      const item = content.events.find((event) => event.id === initialEditEventId) ?? null;

      if (item) {
        return { section: "event", item };
      }
    }

    if (initialOpenCreateEvent) {
      return { section: "event", item: null };
    }

    return null;
  });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventMode, setEventMode] = useState<EventMode>("date");
  const [eventDateValue, setEventDateValue] = useState("");
  const [eventHrefValue, setEventHrefValue] = useState("");
  const [selectedPassportIds, setSelectedPassportIds] = useState<string[]>(defaultPassportIds);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(defaultAddonIds);
  const [eventPriceTableId, setEventPriceTableId] = useState<number | null>(
    defaultPriceTableId ?? null,
  );
  const [eventInformationId, setEventInformationId] = useState<number | null>(
    defaultInformationId ?? null,
  );
  const [eventAvailabilityLoading, setEventAvailabilityLoading] = useState(false);
  const currentEvent =
    editing?.section === "event" ? (editing.item as ManagedEvent | null) : null;

  useEffect(() => {
    if (editing?.section !== "event") {
      return;
    }

    const nextMode = resolveEventMode(currentEvent);
    setEventMode(currentEvent ? nextMode : "date");
    setEventDateValue(resolveEventDate(currentEvent));
    setEventHrefValue(
      currentEvent && nextMode === "link" ? currentEvent.href ?? "" : "",
    );
    setSelectedPassportIds(defaultPassportIds);
    setSelectedAddonIds(defaultAddonIds);
    setEventPriceTableId(defaultPriceTableId ?? null);
    setEventInformationId(defaultInformationId ?? null);
  }, [
    currentEvent,
    defaultAddonIds,
    defaultInformationId,
    defaultPassportIds,
    defaultPriceTableId,
    editing,
  ]);

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
          throw new Error(payload?.error?.message || "Nao foi possivel carregar a data.");
        }

        setSelectedPassportIds(
          payload.data?.selectedPassportIds?.length
            ? payload.data.selectedPassportIds
            : defaultPassportIds,
        );
        setSelectedAddonIds(
          payload.data?.selectedAddonIds?.length
            ? payload.data.selectedAddonIds
            : defaultAddonIds,
        );
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

        setSelectedPassportIds(defaultPassportIds);
        setSelectedAddonIds(defaultAddonIds);
        setEventPriceTableId(defaultPriceTableId ?? null);
        setEventInformationId(defaultInformationId ?? null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nao foi possivel carregar a data do evento.",
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
    defaultAddonIds,
    defaultInformationId,
    defaultPassportIds,
    defaultPriceTableId,
    editing,
    eventDateValue,
    eventMode,
  ]);

  function openCreateEvent() {
    setEditing({ section: "event", item: null });
    setEventMode("date");
    setError(null);
  }

  function openEditEvent(item: ManagedEvent) {
    setEditing({ section: "event", item });
    setError(null);
  }

  function toggleSelection(
    value: string,
    selectedValues: string[],
    setSelectedValues: Dispatch<SetStateAction<string[]>>,
  ) {
    setSelectedValues(
      selectedValues.includes(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value],
    );
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
        formData.delete("passportIds");
        formData.delete("addonIds");

        for (const id of selectedPassportIds) {
          formData.append("passportIds", id);
        }

        for (const id of selectedAddonIds) {
          formData.append("addonIds", id);
        }

        if (eventPriceTableId) {
          formData.set("priceTableId", String(eventPriceTableId));
        }

        if (eventInformationId) {
          formData.set("informationId", String(eventInformationId));
        }
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
        throw new Error(payload?.error?.message || "Nao foi possivel salvar.");
      }

      setEditing(null);
      router.replace("/painel/site");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Nao foi possivel salvar.",
      );
    } finally {
      setPending(false);
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
        throw new Error(payload?.error?.message || "Nao foi possivel excluir.");
      }

      setDeleteTarget(null);
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Nao foi possivel excluir.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="panel-section p-5">
        <p className="panel-eyebrow">Imagens da home</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <h3 className="text-[24px] font-black text-[#17351f]">Banners publicados</h3>
          <button
            type="button"
            onClick={() => setEditing({ section: "home", item: null })}
            className="rounded-full bg-[#17342d] px-5 py-3 text-sm font-black text-white"
          >
            Adicionar imagem
          </button>
        </div>
        <div className="mt-5 flex gap-4 overflow-x-auto pb-3">
          {content.homeImages.map((item) => (
            <article
              key={item.id}
              className="min-w-[320px] rounded-[8px] border border-[#dbe7d7] bg-white p-4"
            >
              <div className="h-36 overflow-hidden rounded-[8px] bg-[#eef3e8]">
                <img
                  src={item.desktopSrc}
                  alt={item.alt}
                  className="block h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <h4 className="mt-3 text-lg font-black text-[#17351f]">{item.alt}</h4>
              <p className="text-sm text-[#5f7564]">{item.active ? "Publicado" : "Oculto"}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing({ section: "home", item })}
                  className="rounded-full border border-[#dbe7d7] px-4 py-2 text-xs font-black text-[#17351f]"
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
          title="Atracoes"
          buttonLabel="Adicionar atracao"
          items={content.attractions}
          onEdit={(item) => setEditing({ section: "attraction", item })}
          onCreate={() => setEditing({ section: "attraction", item: null })}
          onDelete={(item) =>
            setDeleteTarget({
              section: "attraction",
              id: item.id,
              title: item.title,
            })
          }
        />
        <ContentList
          title="Eventos"
          buttonLabel="Adicionar evento"
          items={content.events}
          onEdit={openEditEvent}
          onCreate={openCreateEvent}
          onDelete={(item) =>
            setDeleteTarget({ section: "event", id: item.id, title: item.title })
          }
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
                    className="rounded-[8px] border border-[#dbe7d7] px-4 py-3"
                  />
                </Field>
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
                  <div className="grid gap-3 rounded-[10px] border border-[#dbe7d7] bg-[#fbfdf9] p-4">
                    <div>
                      <p className="text-sm font-black text-[#17351f]">Tipo do evento</p>
                      <p className="mt-1 text-xs leading-5 text-[#5f7564]">
                        Escolha se o botao vai abrir uma data promocional da agenda ou um
                        link externo.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setEventMode("date")}
                        className={`rounded-[8px] border px-4 py-3 text-sm font-black ${
                          eventMode === "date"
                            ? "border-[#17342d] bg-[#17342d] text-white"
                            : "border-[#dbe7d7] bg-white text-[#17351f]"
                        }`}
                      >
                        Data
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventMode("link")}
                        className={`rounded-[8px] border px-4 py-3 text-sm font-black ${
                          eventMode === "link"
                            ? "border-[#17342d] bg-[#17342d] text-white"
                            : "border-[#dbe7d7] bg-white text-[#17351f]"
                        }`}
                      >
                        Link externo
                      </button>
                    </div>
                  </div>
                ) : null}

                <Field label="Titulo">
                  <input
                    name="title"
                    defaultValue={editing.item?.title ?? ""}
                    className="rounded-[8px] border border-[#dbe7d7] px-4 py-3"
                  />
                </Field>

                <Field label="Descricao">
                  <textarea
                    name="description"
                    defaultValue={editing.item?.description ?? ""}
                    rows={4}
                    className="rounded-[8px] border border-[#dbe7d7] px-4 py-3"
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
                            className="rounded-[8px] border border-[#dbe7d7] px-4 py-3"
                          />
                        </Field>

                        <MultiSelectGrid
                          title="Tipo de passaportes"
                          description="Escolha quais passaportes ficam disponiveis para esta data promocional."
                          items={passports.map((product) => ({
                            id: product.id,
                            title: product.title,
                            subtitle: product.subtitle,
                          }))}
                          loading={eventAvailabilityLoading}
                          selectedIds={selectedPassportIds}
                          onToggle={(id) =>
                            toggleSelection(
                              id,
                              selectedPassportIds,
                              setSelectedPassportIds,
                            )
                          }
                          onSelectAll={() => setSelectedPassportIds(defaultPassportIds)}
                        />

                        <MultiSelectGrid
                          title="Adicionais"
                          description="Escolha os adicionais liberados para a data promocional."
                          items={addons.map((product) => ({
                            id: product.id,
                            title: product.title,
                            subtitle: product.subtitle,
                          }))}
                          loading={eventAvailabilityLoading}
                          selectedIds={selectedAddonIds}
                          onToggle={(id) =>
                            toggleSelection(id, selectedAddonIds, setSelectedAddonIds)
                          }
                          onSelectAll={() => setSelectedAddonIds(defaultAddonIds)}
                        />
                      </>
                    ) : (
                      <Field label="Link externo">
                        <input
                          name="hrefVisible"
                          value={eventHrefValue}
                          onChange={(event) => setEventHrefValue(event.target.value)}
                          placeholder="https://site.com.br ou /agenda"
                          className="rounded-[8px] border border-[#dbe7d7] px-4 py-3"
                        />
                      </Field>
                    )}

                    <Field label="Texto do botao">
                      <input
                        name="buttonLabel"
                        defaultValue={currentEvent?.buttonLabel ?? "Compre seu ingresso!"}
                        className="rounded-[8px] border border-[#dbe7d7] px-4 py-3"
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

            <Field label="Ordem">
              <input
                name="sortOrder"
                type="number"
                min="1"
                defaultValue={editing.item?.sortOrder ?? ""}
                className="rounded-[8px] border border-[#dbe7d7] px-4 py-3"
              />
            </Field>

            <label className="flex items-center gap-2 text-sm font-black text-[#17351f]">
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
        title="Confirmar exclusao"
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      >
        <p className="text-sm leading-7 text-[#5f7564]">
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
            className="rounded-full border border-[#dbe7d7] px-5 py-3 text-sm font-black text-[#17351f]"
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
    <label className="grid gap-2 text-sm font-semibold text-[#17351f]">
      {label}
      {children}
    </label>
  );
}

function MultiSelectGrid({
  title,
  description,
  items,
  loading,
  selectedIds,
  onToggle,
  onSelectAll,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; title: string; subtitle?: string | null }>;
  loading: boolean;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}) {
  return (
    <section className="grid gap-3 rounded-[10px] border border-[#dbe7d7] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#17351f]">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[#5f7564]">{description}</p>
        </div>
        <button
          type="button"
          onClick={onSelectAll}
          className="rounded-[8px] border border-[#dbe7d7] px-3 py-2 text-xs font-semibold text-[#17351f]"
        >
          Marcar todos
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-[#5f7564]">Carregando configuracao desta data...</p>
      ) : null}

      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => {
          const checked = selectedIds.includes(item.id);

          return (
            <label
              key={item.id}
              className={`rounded-[8px] border px-3 py-3 text-sm ${
                checked
                  ? "border-[#17342d] bg-[#f4faf2] text-[#17351f]"
                  : "border-[#dbe7d7] bg-white text-[#17351f]"
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(item.id)}
                />
                <span className="min-w-0">
                  <span className="block font-black">{item.title}</span>
                  {item.subtitle ? (
                    <span className="mt-1 block text-xs leading-5 text-[#5f7564]">
                      {item.subtitle}
                    </span>
                  ) : null}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function ContentList<T extends ManagedAttraction | ManagedEvent>({
  title,
  buttonLabel,
  items,
  onEdit,
  onCreate,
  onDelete,
}: {
  title: string;
  buttonLabel: string | null;
  items: T[];
  onEdit: (item: T) => void;
  onCreate: () => void;
  onDelete: (item: T) => void;
}) {
  return (
    <article className="panel-section p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="panel-eyebrow">{title}</p>
        {buttonLabel ? (
          <button
            type="button"
            onClick={onCreate}
            className="rounded-full bg-[#17342d] px-5 py-3 text-sm font-black text-white"
          >
            {buttonLabel}
          </button>
        ) : null}
      </div>
      <div className="mt-5 grid max-h-[520px] gap-3 overflow-y-auto pr-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-[10px] border border-[#dbe7d7] bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-[#17351f]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#5f7564]">{item.description}</p>
              </div>
              <span className="rounded-full bg-[#eef5eb] px-3 py-1 text-xs font-black text-[#2d6b37]">
                #{item.sortOrder}
              </span>
            </div>
            {"buttonLabel" in item ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[#17351f]">
                <span className="rounded-full border border-[#dbe7d7] px-3 py-1">
                  Botao: {item.buttonLabel}
                </span>
              </div>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="rounded-full border border-[#dbe7d7] px-4 py-2 text-xs font-black text-[#17351f]"
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
