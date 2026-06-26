"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PainelAgendaScreenData,
  PainelAgendaStatus,
  PainelAgendaType,
} from "@/lib/painel-agenda";
import {
  formatPainelAgendaDateLabel,
  getPainelAgendaTypeOptions,
} from "@/lib/painel-agenda-ui";
import {
  getB2cBoxOfficePrice,
  getB2cSitePrice,
  type B2cProduct,
} from "@/lib/b2c-catalog-defaults";

type PainelAgendaEditorProps = {
  data: PainelAgendaScreenData;
  actor: {
    name: string | null;
    cpf: string | null;
  };
  mode: "create" | "edit";
  returnHref: string;
  initialType?: PainelAgendaType;
  products: B2cProduct[];
};

type RangePreviewState =
  | { status: "idle"; existingDates: string[]; hasSchoolDates: boolean }
  | { status: "loading"; existingDates: string[]; hasSchoolDates: boolean }
  | { status: "ready"; existingDates: string[]; hasSchoolDates: boolean }
  | {
      status: "error";
      existingDates: string[];
      hasSchoolDates: boolean;
      message: string;
    };

type MutationState =
  | { status: "idle"; message?: undefined }
  | { status: "submitting"; message?: undefined }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

function defaultReason(selectedDate: string | null) {
  return selectedDate
    ? `Atualização da agenda de ${formatPainelAgendaDateLabel(selectedDate)}`
    : "Criação de agenda pelo painel";
}

function buildDefaultForm(
  data: PainelAgendaScreenData,
  initialType?: PainelAgendaType,
) {
  const selectedDate = data.selectedDate ?? null;
  const agenda = data.selectedDay?.agenda ?? null;
  const firstPriceTable = data.priceTables[0]?.id ?? 0;
  const firstInformation = data.informationOptions[0]?.id ?? 0;

  return {
    startDate: selectedDate ?? "",
    endDate: selectedDate ?? "",
    priceTableId: agenda?.priceTableId ?? firstPriceTable,
    informationId: agenda?.informationId ?? firstInformation,
    type: (agenda?.type ?? initialType ?? "padra") as PainelAgendaType,
    status: (agenda?.status ?? "abe") as PainelAgendaStatus,
    promotionName: agenda?.promotionName ?? "",
    promotionDescription: agenda?.promotionDescription ?? "",
    reason: defaultReason(selectedDate),
  };
}


export function PainelAgendaEditor({
  data,
  actor,
  mode,
  returnHref,
  initialType,
  products,
}: PainelAgendaEditorProps) {
  const router = useRouter();
  const selectedAgenda = data.selectedDay?.agenda ?? null;
  const [form, setForm] = useState(() => buildDefaultForm(data, initialType));
  const [rangePreview, setRangePreview] = useState<RangePreviewState>({
    status: "idle",
    existingDates: [],
    hasSchoolDates: false,
  });
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [mutationState, setMutationState] = useState<MutationState>({
    status: "idle",
  });
  const passports = products.filter((product) => product.type === "passport");
  const addons = products.filter((product) => product.type === "addon");
  const [selectedPassportIds, setSelectedPassportIds] = useState<string[]>(() =>
    data.selectedDay?.selectedPassportIds?.length
      ? data.selectedDay.selectedPassportIds
      : passports.map((item) => item.id),
  );
  const [selectedAddonIds] = useState<string[]>(() =>
    data.selectedDay?.selectedAddonIds?.length
      ? data.selectedDay.selectedAddonIds
      : addons.map((item) => item.id),
  );
  const allPassportsSelected =
    passports.length > 0 && selectedPassportIds.length === passports.length;

  function togglePassportSelection(passportId: string) {
    setSelectedPassportIds((current) =>
      current.includes(passportId)
        ? current.filter((item) => item !== passportId)
        : [...current, passportId],
    );
  }

  useEffect(() => {
    if (!form.startDate || !form.endDate) {
      return;
    }

    const controller = new AbortController();

    async function loadPreview() {
      setRangePreview((current) => ({
        status: "loading",
        existingDates: current.existingDates,
        hasSchoolDates: current.hasSchoolDates,
      }));

      try {
        const response = await fetch("/api/painel/agenda/range-check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            excludeAgendaId: selectedAgenda?.id ?? null,
            startDate: form.startDate,
            endDate: form.endDate,
          }),
          signal: controller.signal,
        });
        const payload = (await response.json()) as
          | {
              ok: true;
              data: {
                existingDates: string[];
                hasSchoolDates: boolean;
              };
            }
          | {
              ok: false;
              error: {
                message: string;
              };
            };

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.ok
              ? "Não foi possível verificar a faixa."
              : payload.error.message,
          );
        }

        setRangePreview({
          status: "ready",
          existingDates: payload.data.existingDates,
          hasSchoolDates: payload.data.hasSchoolDates,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setRangePreview({
          status: "error",
          existingDates: [],
          hasSchoolDates: false,
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível verificar a faixa.",
        });
      }
    }

    void loadPreview();

    return () => controller.abort();
  }, [form.startDate, form.endDate, selectedAgenda?.id]);

  const typeOptions = getPainelAgendaTypeOptions(
    mode === "create" ? "padra" : (selectedAgenda?.type ?? null),
  );
  const overwriteRequired = rangePreview.existingDates.length > 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationState({ status: "submitting" });

    try {
      const response = await fetch("/api/painel/agenda", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agendaId: selectedAgenda?.id ?? null,
          ...form,
          passportIds: selectedPassportIds,
          addonIds: selectedAddonIds,
          confirmOverwrite,
          actor,
        }),
      });
      const payload = (await response.json()) as
        | { ok: true; data: { message: string } }
        | { ok: false; error: { message: string } };

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.ok ? "Não foi possível salvar a agenda." : payload.error.message,
        );
      }

      setMutationState({
        status: "success",
        message: payload.data.message,
      });
      router.replace(returnHref);
      router.refresh();
    } catch (error) {
      setMutationState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a agenda.",
      });
    }
  }

  async function handleDelete() {
    if (mode !== "edit" || !selectedAgenda) {
      return;
    }

    setMutationState({ status: "submitting" });

    try {
      const response = await fetch(`/api/painel/agenda/${selectedAgenda.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "Remoção da agenda pelo painel",
          actor,
        }),
      });
      const payload = (await response.json()) as
        | { ok: true; data: { deletedDate: string } }
        | { ok: false; error: { message: string } };

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.ok ? "Não foi possível remover a agenda." : payload.error.message,
        );
      }

      router.replace(`/painel/agenda?mes=${data.month}&ano=${data.year}`);
      router.refresh();
    } catch (error) {
      setMutationState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível remover a agenda.",
      });
    }
  }

  return (
    <section className="panel-section p-4">
      <div>
        <p className="panel-eyebrow !text-[#4d7398]">
          {mode === "create" ? "Adicionar" : "Editar"}
        </p>
        <h2 className="mt-1 text-[28px] font-black leading-tight text-[#123b63]">
          {data.selectedDate
            ? formatPainelAgendaDateLabel(data.selectedDate)
            : "Nova agenda"}
        </h2>
        <p className="mt-2 text-sm text-[#60758d]">
          {mode === "create"
            ? "Configure a data e os ingressos disponíveis."
            : "Atualize a data e os ingressos disponíveis."}
        </p>
        {mode === "create" ? (
          <p className="mt-2 text-sm text-[#60758d]">
            Datas promocionais são cadastradas pelo painel de Site para manter o evento vinculado corretamente.
          </p>
        ) : null}
      </div>

      <form className="mt-5 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 lg:grid-cols-[0.7fr_0.5fr]">
          <label className="grid gap-1.5 text-[13px] font-semibold text-[#123b63]">
            Data
            <input
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  startDate: event.target.value,
                  endDate: event.target.value,
                }))
              }
              className="rounded-[8px] border border-[#d4dfeb] px-3 py-2.5 text-sm font-normal text-[#123b63]"
            />
          </label>

          <label className="grid gap-1.5 text-[13px] font-semibold text-[#123b63]">
            Tipo da agenda
            <select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as PainelAgendaType,
                }))
              }
              className="rounded-[8px] border border-[#d4dfeb] px-3 py-2.5 text-sm font-normal text-[#123b63]"
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {form.type === "promo" ? (
          <div className="grid gap-3 rounded-[8px] border border-[#d4dfeb] bg-[#f8fbff] p-3">
            <label className="grid gap-1.5 text-[13px] font-semibold text-[#123b63]">
              Nome da promoção
              <input
                type="text"
                value={form.promotionName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    promotionName: event.target.value,
                  }))
                }
                className="rounded-[8px] border border-[#d4dfeb] px-3 py-2.5 text-sm font-normal text-[#123b63]"
              />
            </label>
            <label className="grid gap-1.5 text-[13px] font-semibold text-[#123b63]">
              Descrição da promoção
              <textarea
                value={form.promotionDescription}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    promotionDescription: event.target.value,
                  }))
                }
                rows={3}
                className="rounded-[8px] border border-[#d4dfeb] px-3 py-2.5 text-sm font-normal text-[#123b63]"
              />
            </label>
            <label className="grid gap-1.5 text-[13px] font-semibold text-[#123b63]">
              Imagem do evento
              <input
                type="file"
                accept="image/*"
                className="rounded-[8px] border border-dashed border-[#b9cde0] bg-white px-3 py-2.5 text-sm font-normal text-[#123b63]"
              />
            </label>
          </div>
        ) : null}

        <section className="grid gap-3 rounded-[8px] border border-[#d4dfeb] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="panel-eyebrow !text-[#4d7398]">Ingressos</p>
              <h3 className="mt-1 text-lg font-black text-[#123b63]">
                Seleção de ingressos
              </h3>
            </div>
            <button
              type="button"
              onClick={() => router.push("/painel/passaportes-itens")}
              className="rounded-[8px] border border-[#d4dfeb] px-3 py-2 text-xs font-semibold text-[#123b63] hover:bg-[#eef4fb]"
            >
              Gerenciar ingressos
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {passports.length > 0 ? (
              <label className="rounded-[8px] border border-[#d4dfeb] bg-[#eef4fb] px-3 py-2.5 text-sm font-semibold text-[#123b63]">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allPassportsSelected}
                    onChange={(event) =>
                      setSelectedPassportIds(
                        event.target.checked ? passports.map((item) => item.id) : [],
                      )
                    }
                    className="h-4 w-4"
                  />
                  Selecionar todos
                </span>
              </label>
            ) : null}
            {passports.map((item) => (
              <label
                key={item.id}
                className="rounded-[8px] border border-[#d4dfeb] bg-[#f8fbff] px-3 py-2.5 text-sm font-semibold text-[#123b63]"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedPassportIds.includes(item.id)}
                    onChange={() => togglePassportSelection(item.id)}
                    className="h-4 w-4"
                  />
                  {item.title}
                </span>
                <span className="mt-1.5 block text-xs text-[#60758d]">
                  Site R$ {getB2cSitePrice(item).replace(".", ",")} · Bilheteria R${" "}
                  {getB2cBoxOfficePrice(item).replace(".", ",")}
                </span>
              </label>
            ))}
          </div>
        </section>

        {rangePreview.status === "error" ? (
          <div className="rounded-[8px] border border-[#f1b1aa] bg-[#fff4f2] px-4 py-3 text-sm text-[#9d3d31]">
            {rangePreview.message}
          </div>
        ) : null}

        {overwriteRequired ? (
          <label className="flex items-start gap-3 rounded-[8px] border border-[#f0d9aa] bg-[#fff7ea] px-4 py-3 text-sm text-[#7a5b20]">
            <input
              type="checkbox"
              checked={confirmOverwrite}
              onChange={(event) => setConfirmOverwrite(event.target.checked)}
              className="mt-1"
            />
            <span>
              Atualizar as datas já existentes:{" "}
              {rangePreview.existingDates
                .map(formatPainelAgendaDateLabel)
                .join(", ")}
            </span>
          </label>
        ) : null}

        {rangePreview.hasSchoolDates && form.type !== "escol" ? (
          <div className="rounded-[8px] border border-[#f1b1aa] bg-[#fff4f2] px-4 py-3 text-sm text-[#9d3d31]">
            A faixa selecionada contém agendas escolares. Só é permitido manter o tipo escolar nesses dias.
          </div>
        ) : null}

        {mutationState.status === "error" ? (
          <div className="rounded-[8px] border border-[#f1b1aa] bg-[#fff4f2] px-4 py-3 text-sm text-[#9d3d31]">
            {mutationState.message}
          </div>
        ) : null}

        {mutationState.status === "success" ? (
          <div className="rounded-[8px] border border-[#c8e5cf] bg-[#f2fbf5] px-4 py-3 text-sm text-[#2f6a3f]">
            {mutationState.message}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            disabled={
              mutationState.status === "submitting" ||
              (overwriteRequired && !confirmOverwrite) ||
              (rangePreview.hasSchoolDates && form.type !== "escol")
            }
            className="rounded-[8px] bg-[#123b63] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f2f4f] disabled:opacity-60"
          >
            {mutationState.status === "submitting" ? "Salvando..." : "Salvar agenda"}
          </button>

          <button
            type="button"
            onClick={() => router.replace(returnHref)}
            className="rounded-[8px] border border-[#d4dfeb] px-4 py-2.5 text-sm font-semibold text-[#123b63] hover:bg-[#eef4fb]"
          >
            Voltar
          </button>

          {mode === "edit" && selectedAgenda ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={mutationState.status === "submitting"}
              className="rounded-[8px] border border-[#d05f56] px-4 py-2.5 text-sm font-semibold text-[#b24239] disabled:opacity-60"
            >
              Remover dia
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

