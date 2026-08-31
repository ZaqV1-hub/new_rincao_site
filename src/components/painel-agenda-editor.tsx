"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PainelAgendaMonthEntry,
  PainelAgendaScreenData,
  PainelAgendaStatus,
} from "@/lib/painel-agenda";
import {
  buildPainelAgendaCalendar,
  formatPainelAgendaDateLabel,
  formatPainelAgendaMonthLabel,
  getPainelAgendaStatusOptions,
} from "@/lib/painel-agenda-ui";

type PainelAgendaEditorProps = {
  data: PainelAgendaScreenData;
  actor: {
    name: string | null;
    cpf: string | null;
  };
  mode: "create" | "edit";
  returnHref: string;
  initialType?: "padra";
};

type RangePreviewState =
  | { status: "idle"; existingDates: string[]; hasSchoolDates: boolean; hasPromotionalDates: boolean }
  | { status: "loading"; existingDates: string[]; hasSchoolDates: boolean; hasPromotionalDates: boolean }
  | { status: "ready"; existingDates: string[]; hasSchoolDates: boolean; hasPromotionalDates: boolean }
  | {
      status: "error";
      existingDates: string[];
      hasSchoolDates: boolean;
      hasPromotionalDates: boolean;
      message: string;
    };

type MutationState =
  | { status: "idle"; message?: undefined }
  | { status: "submitting"; message?: undefined }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

type SelectionMode = "range" | "specific";

function getDayClasses(
  entry: PainelAgendaMonthEntry | undefined,
  selected: boolean,
  inMonth: boolean,
) {
  const base = inMonth
    ? "border-[#d4dfeb] bg-white text-[#123b63] hover:bg-[#eef6fd]"
    : "border-[#e6edf4] bg-[#f6f9fc] text-[#a8b6c2]";

  if (selected) {
    return "border-[#123b63] bg-[#123b63] text-white ring-2 ring-[#9ec6e5]";
  }

  if (entry?.type === "promo") {
    return "border-[#ffd0c0] bg-[#fff4ef] text-[#9f4420]";
  }

  if (entry?.status === "lot") {
    return "border-[#f2b1b6] bg-[#fff3f4] text-[#8f1e26]";
  }

  if (entry?.status === "fec") {
    return "border-[#bfd0de] bg-[#eef4f8] text-[#24455d]";
  }

  return base;
}

function defaultReason(selectedDate: string | null) {
  return selectedDate
    ? `Atualização da agenda de ${formatPainelAgendaDateLabel(selectedDate)}`
    : "Criação de agenda pelo painel";
}

function buildDefaultForm(
  data: PainelAgendaScreenData,
  initialType?: "padra",
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
    type: initialType ?? "padra",
    status: (agenda?.status ?? "abe") as PainelAgendaStatus,
    reason: defaultReason(selectedDate),
  };
}


export function PainelAgendaEditor({
  data,
  actor,
  mode,
  returnHref,
  initialType,
}: PainelAgendaEditorProps) {
  const router = useRouter();
  const selectedAgenda = data.selectedDay?.agenda ?? null;
  const [form, setForm] = useState(() => buildDefaultForm(data, initialType));
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("range");
  const [selectedDates, setSelectedDates] = useState<string[]>(() =>
    data.selectedDate ? [data.selectedDate] : [],
  );
  const [rangePreview, setRangePreview] = useState<RangePreviewState>({
    status: "idle",
    existingDates: [],
    hasSchoolDates: false,
    hasPromotionalDates: false,
  });
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [mutationState, setMutationState] = useState<MutationState>({
    status: "idle",
  });

  useEffect(() => {
    const isSpecificMode = selectionMode === "specific";

    if (
      (!isSpecificMode && (!form.startDate || !form.endDate)) ||
      (isSpecificMode && selectedDates.length === 0)
    ) {
      return;
    }

    const controller = new AbortController();

    async function loadPreview() {
      setRangePreview((current) => ({
        status: "loading",
        existingDates: current.existingDates,
        hasSchoolDates: current.hasSchoolDates,
        hasPromotionalDates: current.hasPromotionalDates,
      }));

      try {
        const response = await fetch("/api/painel/agenda/range-check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            excludeAgendaId: selectedAgenda?.id ?? null,
            startDate: isSpecificMode
              ? selectedDates[0]
              : form.startDate,
            endDate: isSpecificMode
              ? selectedDates[selectedDates.length - 1]
              : form.endDate,
            selectedDates: isSpecificMode ? selectedDates : [],
          }),
          signal: controller.signal,
        });
        const payload = (await response.json()) as
          | {
              ok: true;
              data: {
                existingDates: string[];
                hasSchoolDates: boolean;
                hasPromotionalDates: boolean;
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
          hasPromotionalDates: payload.data.hasPromotionalDates,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setRangePreview({
          status: "error",
          existingDates: [],
          hasSchoolDates: false,
          hasPromotionalDates: false,
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível verificar a faixa.",
        });
      }
    }

    void loadPreview();

    return () => controller.abort();
  }, [form.startDate, form.endDate, selectedAgenda?.id, selectedDates, selectionMode]);

  const statusOptions = getPainelAgendaStatusOptions();
  const overwriteRequired = rangePreview.existingDates.length > 0;
  const hasLockedDates =
    rangePreview.hasSchoolDates || rangePreview.hasPromotionalDates;
  const entriesByDate = new Map(data.entries.map((entry) => [entry.date, entry]));
  const calendarCells = buildPainelAgendaCalendar(data.month, data.year);
  const selectedDateSet = new Set(selectedDates);

  function toggleSelectedDate(date: string) {
    setSelectedDates((current) =>
      current.includes(date)
        ? current.filter((item) => item !== date)
        : [...current, date].sort(),
    );
    setConfirmOverwrite(false);
  }

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
          startDate:
            selectionMode === "specific" ? selectedDates[0] ?? "" : form.startDate,
          endDate:
            selectionMode === "specific"
              ? selectedDates[selectedDates.length - 1] ?? ""
              : form.endDate,
          selectedDates: selectionMode === "specific" ? selectedDates : [],
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
            ? "Configure a data e a tabela de preço disponível."
            : "Atualize a data e a tabela de preço disponível."}
        </p>
        {mode === "create" ? (
          <p className="mt-2 text-sm text-[#60758d]">
            Datas promocionais são cadastradas pelo painel de Site para manter o evento vinculado corretamente.
          </p>
        ) : null}
      </div>

      <form className="mt-5 grid gap-3" onSubmit={handleSubmit}>
        {mode === "create" ? (
          <div className="inline-flex w-fit overflow-hidden rounded-[8px] border border-[#d4dfeb] bg-white text-sm font-semibold text-[#123b63]">
            <button
              type="button"
              onClick={() => {
                setSelectionMode("range");
                setConfirmOverwrite(false);
              }}
              className={`px-4 py-2 ${selectionMode === "range" ? "bg-[#123b63] text-white" : "hover:bg-[#eef4fb]"}`}
            >
              Período
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectionMode("specific");
                setConfirmOverwrite(false);
              }}
              className={`px-4 py-2 ${selectionMode === "specific" ? "bg-[#123b63] text-white" : "hover:bg-[#eef4fb]"}`}
            >
              Datas específicas
            </button>
          </div>
        ) : null}

        {selectionMode === "range" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1.5 text-[13px] font-semibold text-[#123b63]">
              Data inicial
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => {
                  setConfirmOverwrite(false);
                  setForm((current) => ({
                    ...current,
                    startDate: event.target.value,
                    endDate:
                      current.endDate && current.endDate >= event.target.value
                        ? current.endDate
                        : event.target.value,
                  }));
                }}
                className="rounded-[8px] border border-[#d4dfeb] px-3 py-2.5 text-sm font-normal text-[#123b63]"
              />
            </label>

            <label className="grid gap-1.5 text-[13px] font-semibold text-[#123b63]">
              Data final
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => {
                  setConfirmOverwrite(false);
                  setForm((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }));
                }}
                className="rounded-[8px] border border-[#d4dfeb] px-3 py-2.5 text-sm font-normal text-[#123b63]"
              />
            </label>
          </div>
        ) : (
          <section className="grid gap-3 rounded-[8px] border border-[#d4dfeb] bg-[#f8fbff] p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="panel-eyebrow !text-[#4d7398]">Datas específicas</p>
                <h3 className="mt-1 text-lg font-black text-[#123b63]">
                  {formatPainelAgendaMonthLabel(data.month, data.year)}
                </h3>
              </div>
              <div className="text-sm font-semibold text-[#60758d]">
                {selectedDates.length} selecionada(s)
              </div>
            </div>
            <div className="grid grid-cols-7 border border-[#d4dfeb] bg-[#123b63] text-center text-[13px] font-semibold text-white">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((label, index) => (
                <div key={`${label}-${index}`} className="px-2 py-2">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell) => {
                const entry = entriesByDate.get(cell.date);
                const selected = selectedDateSet.has(cell.date);

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => cell.inMonth && toggleSelectedDate(cell.date)}
                    disabled={!cell.inMonth}
                    className={`min-h-[58px] rounded-[8px] border px-2 py-1.5 text-left text-xs transition disabled:cursor-not-allowed ${getDayClasses(
                      entry,
                      selected,
                      cell.inMonth,
                    )}`}
                  >
                    <span className="block text-sm font-black">{cell.day}</span>
                    {entry ? (
                      <span className="mt-1 block leading-3">
                        {entry.typeLabel} · {entry.statusLabel}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <label className="grid gap-1.5 text-[13px] font-semibold text-[#123b63] lg:max-w-[340px]">
          Status da agenda
          <select
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as PainelAgendaStatus,
              }))
            }
            className="rounded-[8px] border border-[#d4dfeb] px-3 py-2.5 text-sm font-normal text-[#123b63]"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <section className="grid gap-3 rounded-[8px] border border-[#d4dfeb] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="panel-eyebrow !text-[#4d7398]">Tabela de preço</p>
              <h3 className="mt-1 text-lg font-black text-[#123b63]">
                Seleção da tabela
              </h3>
            </div>
            <button
              type="button"
              onClick={() => router.push("/painel/tabela-preco")}
              className="rounded-[8px] border border-[#d4dfeb] px-3 py-2 text-xs font-semibold text-[#123b63] hover:bg-[#eef4fb]"
            >
              Gerenciar tabelas
            </button>
          </div>
          <label className="grid gap-1.5 text-[13px] font-semibold text-[#123b63]">
            Tabela de preço da agenda
            <select
              value={String(form.priceTableId || "")}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priceTableId: Number(event.target.value),
                }))
              }
              className="rounded-[8px] border border-[#d4dfeb] bg-[#f8fbff] px-3 py-2.5 text-sm font-normal text-[#123b63]"
            >
              <option value="">Selecione</option>
              {data.priceTables.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-[#60758d]">
            Essa tela define apenas a data, status e tabela de preço da agenda.
          </p>
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

        {hasLockedDates ? (
          <div className="rounded-[8px] border border-[#f1b1aa] bg-[#fff4f2] px-4 py-3 text-sm text-[#9d3d31]">
            A faixa selecionada contém datas escolares ou promocionais. Ajuste a faixa para alterar apenas datas padrão.
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
              (selectionMode === "specific" && selectedDates.length === 0) ||
              (overwriteRequired && !confirmOverwrite) ||
              hasLockedDates
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
