"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PainelClienteDetailResult } from "@/lib/painel-clientes";

type PainelClienteFormPageProps = {
  mode: "create" | "edit";
  typeOptions: Array<{
    id: number;
    name: string;
  }>;
  client?: PainelClienteDetailResult | null;
};

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toDateInputValue(value: string) {
  const normalized = value.trim();
  const slashMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  return "";
}

function toLegacyDateValue(value: string) {
  const normalized = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

export function PainelClienteFormPage({
  mode,
  typeOptions,
  client = null,
}: PainelClienteFormPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tripDateMessage, setTripDateMessage] = useState<string | null>(
    searchParams.get("success"),
  );
  const [tripDateError, setTripDateError] = useState<string | null>(null);
  const [tripDateValue, setTripDateValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isTripDatePending, startTripDateTransition] = useTransition();

  const initialTypeId = client ? String(client.client.typeId) : "";
  const initialName = client?.client.name ?? "";
  const initialStatus = client?.client.active === false ? "0" : "1";

  function refreshClientEditor(message?: string | null) {
    if (!client) {
      router.refresh();
      return;
    }

    const nextUrl = new URL(
      `/painel/clientes/editar?id=${client.client.id}`,
      window.location.origin,
    );

    if (message) {
      nextUrl.searchParams.set("success", message);
    }

    router.push(`${nextUrl.pathname}${nextUrl.search}`);
    router.refresh();
  }

  async function mutateTripDate(
    path: string,
    options: RequestInit,
    successMessage: string,
  ) {
    startTripDateTransition(async () => {
      setTripDateError(null);
      setTripDateMessage(null);

      try {
        const response = await fetch(path, {
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            ...(options.headers ?? {}),
          },
          ...options,
        });

        const result = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              data?: { message?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !result?.ok) {
          throw new Error(
            result?.error?.message ||
              "Nao foi possivel atualizar a data do passeio agora.",
          );
        }

        setTripDateValue("");
        setTripDateMessage(result.data?.message || successMessage);
        refreshClientEditor(result.data?.message || successMessage);
      } catch (error) {
        setTripDateError(
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar a data do passeio agora.",
        );
      }
    });
  }

  async function handleTripDateSubmit(formData: FormData) {
    if (!client) {
      return;
    }

    const payload = {
      datapasseio: toLegacyDateValue(String(formData.get("datapasseio") ?? "")),
    };

    await mutateTripDate(
      `/api/painel/clientes/${client.client.id}/trip-dates`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      "Data do passeio adicionada com sucesso.",
    );
  }

  function handleTripDateStatusToggle(agendaId: number, nextStatus: "ati" | "ina") {
    if (!client) {
      return;
    }

    void mutateTripDate(
      `/api/painel/clientes/${client.client.id}/trip-dates/${agendaId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      },
      nextStatus === "ati"
        ? "Data do passeio ativada com sucesso."
        : "Data do passeio inativada com sucesso.",
    );
  }

  function handleTripDateDelete(agendaId: number, dateLabel: string) {
    if (!client) {
      return;
    }

    if (!window.confirm(`Deseja realmente remover a data ${dateLabel}?`)) {
      return;
    }

    void mutateTripDate(
      `/api/painel/clientes/${client.client.id}/trip-dates/${agendaId}`,
      {
        method: "DELETE",
      },
      "Data do passeio removida com sucesso.",
    );
  }

  async function handleSubmit(formData: FormData) {
    const payload = {
      idtipo: String(formData.get("idtipo") ?? ""),
      nome: String(formData.get("nome") ?? ""),
      status: String(formData.get("status") ?? "1"),
    };

    startTransition(async () => {
      setErrorMessage(null);

      try {
        const response = await fetch(
          mode === "create"
            ? "/api/painel/clientes"
            : `/api/painel/clientes/${client?.client.id}`,
          {
            method: mode === "create" ? "POST" : "PATCH",
            credentials: "same-origin",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );

        const result = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              data?: { clientId?: number; message?: string };
              error?: { message?: string };
            }
          | null;

        if (!response.ok || !result?.ok) {
          throw new Error(
            result?.error?.message || "Nao foi possivel salvar o cliente agora.",
          );
        }

        const nextClientId = result.data?.clientId;
        if (!nextClientId) {
          throw new Error("Resposta invalida ao salvar cliente.");
        }

        router.push(
          mode === "create"
            ? `/painel/clientes/editar?id=${nextClientId}&success=${encodeURIComponent(
                "Cliente criado com sucesso.",
              )}`
            : `/painel/clientes/editar?id=${nextClientId}&success=${encodeURIComponent(
                result.data?.message || "Cliente atualizado com sucesso.",
              )}`,
        );
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o cliente agora.",
        );
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
        <div className="border-b border-[#d8d8d8] pb-3 text-sm text-[#909090]">
          <Link className="text-[#1d68a2] underline" href="/painel">
            Home
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <Link className="text-[#1d68a2] underline" href="/painel/clientes">
            Clientes
          </Link>{" "}
          <span className="mx-2 text-[#b8b8b8]">&gt;</span>
          <span>{mode === "create" ? "Adicionar" : "Editar"}</span>
        </div>

        {errorMessage ? (
          <div className="mt-4 border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
            {errorMessage}
          </div>
        ) : null}

        {!errorMessage && mode === "edit" && tripDateMessage ? (
          <div className="mt-4 border border-[#cfe8bf] bg-[#f3ffeb] px-4 py-3 text-sm text-[#3f6e1d]">
            {tripDateMessage}
          </div>
        ) : null}

        <form action={handleSubmit} className="mt-6 grid gap-6">
          <table className="w-full border-collapse text-[15px]">
            <tbody>
              <tr>
                <th className="w-[20%] border border-[#d7d7d7] bg-[#f4f4f4] px-4 py-3 text-left font-bold text-[#555]">
                  <label htmlFor="idtipo">Tipo</label>
                </th>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  <select
                    className="h-10 w-[260px] max-w-full border border-[#d7d7d7] px-3 text-[15px]"
                    defaultValue={initialTypeId}
                    id="idtipo"
                    name="idtipo"
                  >
                    <option value="">Selecione</option>
                    {typeOptions.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
              <tr>
                <th className="border border-[#d7d7d7] bg-[#f4f4f4] px-4 py-3 text-left font-bold text-[#555]">
                  <label htmlFor="nome">Nome</label>
                </th>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  <input
                    className="h-10 w-[420px] max-w-full border border-[#d7d7d7] px-3 text-[15px]"
                    defaultValue={initialName}
                    id="nome"
                    name="nome"
                    type="text"
                  />
                </td>
              </tr>
              <tr>
                <th className="border border-[#d7d7d7] bg-[#f4f4f4] px-4 py-3 text-left font-bold text-[#555]">
                  <label htmlFor="status">Status</label>
                </th>
                <td className="border border-[#d7d7d7] px-4 py-3">
                  <select
                    className="h-10 w-[160px] max-w-full border border-[#d7d7d7] px-3 text-[15px]"
                    defaultValue={initialStatus}
                    id="status"
                    name="status"
                  >
                    <option value="1">Ativo</option>
                    <option value="0">Inativo</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="border border-[#2f7f2f] bg-[#4b9c38] px-5 py-2.5 text-sm font-bold text-white"
              disabled={isPending}
              type="submit"
            >
              {mode === "create" ? "Salvar" : "Enviar"}
            </button>
            <Link
              className="border border-[#c5c5c5] bg-[#f8f8f8] px-5 py-2.5 text-sm text-[#555]"
              href={mode === "create" ? "/painel/clientes" : `/painel/clientes/detalhe?id=${client?.client.id}`}
            >
              Cancelar
            </Link>
          </div>
        </form>
      </section>

      {client ? (
        <>
          <section className="rounded-[6px] bg-white px-4 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)] md:px-8">
            <h2 className="text-[28px] text-[#3f3f3f]">Historicos de Datas de Passeio</h2>
            <div className="mt-5 rounded-[4px] border border-[#d7d7d7] bg-[#f8fafc] px-5 py-4">
              <div className="text-sm font-bold text-[#495866]">Adicionar data de passeio</div>
              <form action={handleTripDateSubmit} className="mt-3 flex flex-wrap items-end gap-3">
                <div className="grid gap-1">
                  <label className="text-sm font-bold text-[#555]" htmlFor="datapasseio">
                    Data do Passeio
                  </label>
                  <input
                    className="h-10 w-[180px] max-w-full border border-[#d7d7d7] px-3 text-[15px]"
                    id="datapasseio"
                    name="datapasseio"
                    onChange={(event) => setTripDateValue(event.target.value)}
                    type="date"
                    value={toDateInputValue(tripDateValue)}
                  />
                </div>
                <button
                  className="border border-[#2f7f2f] bg-[#4b9c38] px-5 py-2.5 text-sm font-bold text-white"
                  disabled={isTripDatePending}
                  type="submit"
                >
                  Adicionar
                </button>
              </form>

              {tripDateError ? (
                <div className="mt-3 border border-[#efc0c0] bg-[#fff0f0] px-4 py-3 text-sm text-[#7a2b2b]">
                  {tripDateError}
                </div>
              ) : null}
            </div>

            <div className="mt-4 overflow-x-auto border border-[#cfcfcf]">
              <table className="min-w-full border-collapse text-[15px]">
                <thead className="bg-[#5f84a3] text-left text-white">
                  <tr>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Data do Passeio</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Status</th>
                    <th className="border border-[#6f8ea8] px-4 py-3 font-normal">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {client.tripDates.length > 0 ? (
                    client.tripDates.map((tripDate, index) => (
                      <tr className={index % 2 === 1 ? "bg-[#fafafa]" : "bg-white"} key={tripDate.agendaId}>
                        <td className="border border-[#d7d7d7] px-4 py-3">
                          <Link
                            className="text-[#1868d6] underline"
                            href={`/painel/clientes/passeios/${tripDate.agendaId}/alunos?clientId=${client.client.id}`}
                          >
                            {formatDate(tripDate.date)}
                          </Link>
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3">
                          {tripDate.statusLabel}
                        </td>
                        <td className="border border-[#d7d7d7] px-4 py-3">
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <button
                              className="text-[#1868d6] underline"
                              disabled={isTripDatePending}
                              onClick={() =>
                                handleTripDateStatusToggle(
                                  tripDate.agendaId,
                                  tripDate.statusCode === "abe" ? "ina" : "ati",
                                )
                              }
                              type="button"
                            >
                              {tripDate.statusCode === "abe" ? "Inativar" : "Ativar"}
                            </button>
                            <button
                              className="text-[#b53a2d] underline"
                              disabled={isTripDatePending}
                              onClick={() =>
                                handleTripDateDelete(
                                  tripDate.agendaId,
                                  formatDate(tripDate.date),
                                )
                              }
                              type="button"
                            >
                              Remover
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="border border-[#d7d7d7] px-4 py-5 text-center" colSpan={3}>
                        Nao ha dados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {client.education ? (
            <section className="rounded-[6px] bg-white px-8 py-6 shadow-[0_10px_28px_rgba(26,61,94,0.08)]">
              <h2 className="text-[28px] text-[#3f3f3f]">Estrutura Escolar</h2>
              <p className="mt-2 text-sm text-[#667]">
                Estrutura atual de turmas e periodos do cliente escola.
              </p>

              <div className="mt-4 grid gap-4">
                {client.education.classes.length > 0 ? (
                  client.education.classes.map((classItem) => (
                    <div className="border border-[#d7d7d7]" key={classItem.id}>
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#eef3f8] px-4 py-3">
                        <strong className="text-[#2d4050]">{classItem.name}</strong>
                        <span className="text-sm text-[#5e6d7a]">
                          Status: {classItem.status === "ati" ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <div className="px-4 py-3 text-sm text-[#555]">
                        {classItem.periods.length > 0 ? (
                          classItem.periods.map((period) => period.name).join(", ")
                        ) : (
                          <span>Nenhum periodo cadastrado.</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#777]">Nenhuma turma cadastrada.</p>
                )}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
