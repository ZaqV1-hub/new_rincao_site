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

type PainelAgendaEditorProps = {
  data: PainelAgendaScreenData;
  actor: {
    name: string | null;
    cpf: string | null;
  };
  mode: "create" | "edit";
  returnHref: string;
  initialType?: PainelAgendaType;
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
  const selectedPassportIds = data.selectedDay?.selectedPassportIds ?? null;
  const selectedAddonIds = data.selectedDay?.selectedAddonIds ?? null;

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
            Essa tela define a tabela de preço da data. A disponibilidade de passaportes continua usando a configuração padrão já existente.
          </p>
        </section>

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

